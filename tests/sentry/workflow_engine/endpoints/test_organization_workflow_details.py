from sentry import audit_log
from sentry.api.serializers import serialize
from sentry.constants import ObjectStatus
from sentry.deletions.models.scheduleddeletion import RegionScheduledDeletion
from sentry.deletions.tasks.scheduled import run_scheduled_deletions
from sentry.models.auditlogentry import AuditLogEntry
from sentry.silo.base import SiloMode
from sentry.testutils.cases import APITestCase
from sentry.testutils.helpers import TaskRunner
from sentry.testutils.outbox import outbox_runner
from sentry.testutils.silo import assume_test_silo_mode, region_silo_test
from sentry.workflow_engine.endpoints.validators.base.workflow import WorkflowValidator
from sentry.workflow_engine.models import Action, DataConditionGroup, Workflow
from tests.sentry.workflow_engine.test_base import BaseWorkflowTest


class OrganizationWorkflowDetailsBaseTest(APITestCase):
    endpoint = "sentry-api-0-organization-workflow-details"

    def setUp(self):
        super().setUp()
        self.login_as(user=self.user)


@region_silo_test
class OrganizationWorkflowIndexGetTest(OrganizationWorkflowDetailsBaseTest):
    def test_simple(self):
        workflow = self.create_workflow(organization_id=self.organization.id)
        response = self.get_success_response(self.organization.slug, workflow.id)
        assert response.data == serialize(workflow)

    def test_does_not_exist(self):
        self.get_error_response(self.organization.slug, 3, status_code=404)

    def test_pending_deletion(self):
        workflow = self.create_workflow(organization_id=self.organization.id)
        workflow.status = ObjectStatus.PENDING_DELETION
        workflow.save()
        self.get_error_response(self.organization.slug, workflow.id, status_code=404)


@region_silo_test
class OrganizationUpdateWorkflowTest(OrganizationWorkflowDetailsBaseTest, BaseWorkflowTest):
    method = "PUT"

    def setUp(self):
        super().setUp()
        self.valid_workflow = {
            "name": "Test Workflow",
            "enabled": True,
            "config": {},
            "triggers": {"logicType": "any", "conditions": []},
            "action_filters": [],
        }
        validator = WorkflowValidator(
            data=self.valid_workflow,
            context={"organization": self.organization, "request": self.make_request()},
        )
        validator.is_valid(raise_exception=True)
        self.workflow = validator.create(validator.validated_data)

    def test_simple(self):
        self.valid_workflow["name"] = "Updated Workflow"
        response = self.get_success_response(
            self.organization.slug, self.workflow.id, raw_data=self.valid_workflow
        )
        updated_workflow = Workflow.objects.get(id=response.data.get("id"))

        assert response.status_code == 200
        assert updated_workflow.name == "Updated Workflow"


@region_silo_test
class OrganizationDeleteWorkflowTest(OrganizationWorkflowDetailsBaseTest, BaseWorkflowTest):
    method = "DELETE"

    def tasks(self):
        return TaskRunner()

    def setUp(self):
        super().setUp()
        self.workflow = self.create_workflow(organization_id=self.organization.id)

    def test_simple(self):
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()
        self.workflow.refresh_from_db()
        assert self.workflow.status == ObjectStatus.PENDING_DELETION

    def test_audit_entry(self):
        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        with assume_test_silo_mode(SiloMode.CONTROL):
            assert AuditLogEntry.objects.filter(
                target_object=self.workflow.id,
                event=audit_log.get_event_id("WORKFLOW_REMOVE"),
                actor=self.user,
            ).exists()

    def test_does_not_exist(self):
        with outbox_runner():
            response = self.get_error_response(self.organization.slug, 999999999)
            assert response.status_code == 404

        # Ensure it wasn't deleted
        assert not RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

    def test_delete_configured_workflow__action(self):
        action_condition_group, action = self.create_workflow_action(workflow=self.workflow)

        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        # Ensure the workflow is scheduled for deletion
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

        # Delete the workflow
        with self.tasks():
            run_scheduled_deletions()

        # Ensure action is removed
        assert not Action.objects.filter(id=action.id).exists()

    def test_delete_configured_workflow__action_condition(self):
        action_condition_group, action = self.create_workflow_action(workflow=self.workflow)

        with outbox_runner():
            self.get_success_response(self.organization.slug, self.workflow.id)

        # Ensure the workflow is scheduled for deletion
        assert RegionScheduledDeletion.objects.filter(
            model_name="Workflow",
            object_id=self.workflow.id,
        ).exists()

        # Actually delete the workflow
        with self.tasks():
            run_scheduled_deletions()

        assert not DataConditionGroup.objects.filter(id=action_condition_group.id).exists()

    def test_without_permissions(self):
        # Create a workflow with a different organization
        new_org = self.create_organization()
        workflow = self.create_workflow(organization_id=new_org.id)

        with outbox_runner():
            response = self.get_error_response(self.organization.slug, workflow.id)
            assert response.status_code == 404

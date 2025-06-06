import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {AvatarUploader} from 'sentry/components/avatarUploader';
import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {SentryAppAvatar} from 'sentry/components/core/avatar/sentryAppAvatar';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Well from 'sentry/components/well';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SentryApp, SentryAppAvatarPhotoType} from 'sentry/types/integrations';
import type {Organization, Team} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import withApi from 'sentry/utils/withApi';

export type Model = Pick<AvatarUser, 'avatar'>;
type AvatarType = Required<Model>['avatar']['avatarType'];
type AvatarChooserType =
  | 'user'
  | 'team'
  | 'organization'
  | 'sentryAppColor'
  | 'sentryAppSimple'
  | 'docIntegration';
type DefaultChoice = {
  allowDefault?: boolean;
  choiceText?: string;
  preview?: React.ReactNode;
};

type DefaultProps = {
  onSave: (model: Model) => void;
  allowGravatar?: boolean;
  allowLetter?: boolean;
  allowUpload?: boolean;
  defaultChoice?: DefaultChoice;
  type?: AvatarChooserType;
  uploadDomain?: string;
};

type Props = {
  api: Client;
  endpoint: string;
  model: Model;
  disabled?: boolean;
  help?: React.ReactNode;
  isUser?: boolean;
  savedDataUrl?: string;
  title?: string;
} & DefaultProps;

type State = {
  hasError: boolean;
  model: Model;
  dataUrl?: string | null;
  savedDataUrl?: string | null;
};

class AvatarChooser extends Component<Props, State> {
  static defaultProps: DefaultProps = {
    allowGravatar: true,
    allowLetter: true,
    allowUpload: true,
    type: 'user',
    onSave: () => {},
    defaultChoice: {
      allowDefault: false,
    },
    uploadDomain: '',
  };

  state: State = {
    model: this.props.model,
    savedDataUrl: null,
    dataUrl: null,
    hasError: false,
  };

  componentDidUpdate(prevProps: Props) {
    const {model} = this.props;

    // Update local state if defined in props
    if (model !== undefined && model !== prevProps.model) {
      this.setState({model});
    }
  }

  getModelFromResponse(resp: any): Model {
    const {type} = this.props;
    const isSentryApp = type?.startsWith('sentryApp');
    // SentryApp endpoint returns all avatars, we need to return only the edited one
    if (!isSentryApp) {
      return resp;
    }
    const isColor = type === 'sentryAppColor';
    return {
      avatar: resp?.avatars?.find(({color}: any) => color === isColor) ?? undefined,
    };
  }

  handleError(msg: string) {
    addErrorMessage(msg);
  }

  handleSuccess(model: Model) {
    const {onSave} = this.props;
    this.setState({model});
    onSave(model);
    addSuccessMessage(t('Successfully saved avatar preferences'));
  }

  handleSaveSettings = (ev: React.MouseEvent) => {
    const {endpoint, api, type} = this.props;
    const {model, dataUrl} = this.state;

    ev.preventDefault();
    const avatarType = model?.avatar?.avatarType;
    const avatarPhoto = dataUrl?.split(',')[1];

    const data: {
      avatar_photo?: string;
      avatar_type?: string;
      color?: boolean;
      photoType?: SentryAppAvatarPhotoType;
    } = {avatar_type: avatarType};

    // If an image has been uploaded, then another option is selected, we should not submit the uploaded image
    if (avatarType === 'upload') {
      data.avatar_photo = avatarPhoto;
    }

    if (type?.startsWith('sentryApp')) {
      data.color = type === 'sentryAppColor';
      data.photoType = data.color ? 'logo' : 'icon';
    }

    api.request(endpoint, {
      method: 'PUT',
      data,
      success: resp => {
        this.setState({savedDataUrl: this.state.dataUrl});
        this.handleSuccess(this.getModelFromResponse(resp));
      },
      error: resp => {
        const avatarPhotoErrors = resp?.responseJSON?.avatar_photo || [];
        if (avatarPhotoErrors.length) {
          avatarPhotoErrors.map(this.handleError);
        } else {
          this.handleError.bind(this, t('There was an error saving your preferences.'));
        }
      },
    });
  };

  handleChange = (id: AvatarType) =>
    this.setState(state => ({
      model: {
        ...state.model,
        avatar: {avatarUuid: state.model.avatar?.avatarUuid ?? '', avatarType: id},
      },
    }));

  render() {
    const {
      allowGravatar,
      allowUpload,
      allowLetter,
      savedDataUrl,
      type,
      isUser,
      disabled,
      title,
      help,
      defaultChoice,
      uploadDomain,
    } = this.props;
    const {hasError, model, dataUrl} = this.state;

    if (hasError) {
      return <LoadingError />;
    }
    if (!model) {
      return <LoadingIndicator />;
    }
    const {allowDefault, preview, choiceText: defaultChoiceText} = defaultChoice || {};

    const avatarType = model.avatar?.avatarType ?? 'letter_avatar';
    const isLetter = avatarType === 'letter_avatar';
    const isDefault = Boolean(preview && avatarType === 'default');

    const isTeam = type === 'team';
    const isOrganization = type === 'organization';
    const isSentryApp = type?.startsWith('sentryApp');

    const choices: Array<[AvatarType, string]> = [];

    if (allowDefault && preview) {
      choices.push(['default', defaultChoiceText ?? t('Use default avatar')]);
    }
    if (allowLetter) {
      choices.push(['letter_avatar', t('Use initials')]);
    }
    if (allowUpload) {
      choices.push(['upload', t('Upload an image')]);
    }
    if (allowGravatar) {
      choices.push(['gravatar', t('Use Gravatar')]);
    }

    const sharedAvatarProps = {
      gravatar: false,
      style: {width: 90, height: 90},
    };

    const avatar = isUser ? (
      <UserAvatar {...sharedAvatarProps} user={model as AvatarUser} />
    ) : isOrganization ? (
      <OrganizationAvatar {...sharedAvatarProps} organization={model as Organization} />
    ) : isTeam ? (
      <TeamAvatar {...sharedAvatarProps} team={model as Team} />
    ) : isSentryApp ? (
      <SentryAppAvatar {...sharedAvatarProps} sentryApp={model as SentryApp} />
    ) : null;

    return (
      <Panel>
        <PanelHeader>{title || t('Avatar')}</PanelHeader>
        <PanelBody>
          <AvatarForm>
            <AvatarGroup inline={isLetter || isDefault}>
              <RadioGroup
                style={{flex: 1}}
                choices={choices}
                value={avatarType}
                label={t('Avatar Type')}
                onChange={this.handleChange}
                disabled={disabled}
              />
              {isLetter && avatar}
              {isDefault && preview}
            </AvatarGroup>
            <AvatarUploadSection>
              {allowGravatar && avatarType === 'gravatar' && (
                <Well>
                  {t('Gravatars are managed through ')}
                  <ExternalLink href="http://gravatar.com">Gravatar.com</ExternalLink>
                </Well>
              )}
              {model.avatar && avatarType === 'upload' && (
                <AvatarUploader
                  {...this.props}
                  type={type!}
                  model={model}
                  savedDataUrl={savedDataUrl}
                  uploadDomain={uploadDomain ?? ''}
                  updateDataUrlState={dataState => this.setState(dataState)}
                />
              )}
              <AvatarSubmit className="form-actions">
                {help && <AvatarHelp>{help}</AvatarHelp>}
                <Button
                  priority="primary"
                  onClick={this.handleSaveSettings}
                  disabled={disabled || (avatarType === 'upload' && !dataUrl)}
                >
                  {t('Save Avatar')}
                </Button>
              </AvatarSubmit>
            </AvatarUploadSection>
          </AvatarForm>
        </PanelBody>
      </Panel>
    );
  }
}

const AvatarHelp = styled('p')`
  margin-right: auto;
  color: ${p => p.theme.subText};
  font-size: 14px;
  width: 50%;
`;

const AvatarGroup = styled('div')<{inline: boolean}>`
  display: flex;
  flex-direction: ${p => (p.inline ? 'row' : 'column')};
`;

const AvatarForm = styled('div')`
  line-height: ${space(3)};
  padding: ${space(1.5)} ${space(2)};
  margin: ${space(1.5)} ${space(1)} ${space(0.5)};
`;

const AvatarSubmit = styled('fieldset')`
  display: flex;
  align-items: center;
  margin-top: ${space(4)};
  padding-top: ${space(1.5)};
`;

const AvatarUploadSection = styled('div')`
  margin-top: ${space(1.5)};
`;

export default withApi(AvatarChooser);

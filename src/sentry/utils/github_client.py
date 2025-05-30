from requests.exceptions import HTTPError

from sentry.http import build_session
from sentry.shared_integrations.exceptions import ApiError


class GitHubClient:
    ApiError = ApiError

    url = "https://api.github.com"

    def __init__(self, url=None, token=None, client_id=None, client_secret=None):
        if url is not None:
            self.url = url.rstrip("/")
        self.token = token
        self.client_id = client_id
        self.client_secret = client_secret

    def _request(self, method, path, headers=None, data=None, params=None, auth=None):
        with build_session() as session:
            try:
                resp = getattr(session, method.lower())(
                    url=f"{self.url}{path}",
                    headers=headers,
                    json=data,
                    params=params,
                    allow_redirects=True,
                    auth=auth,
                )
                resp.raise_for_status()
            except HTTPError as e:
                raise ApiError.from_response(e.response)
        return resp.json()

    def request(self, method, path, data=None, params=None, auth=None):
        headers = {"Accept": "application/vnd.github.valkyrie-preview+json"}

        if self.token:
            headers.setdefault("Authorization", f"token {self.token}")

        elif auth is None and self.client_id and self.client_secret:
            auth = (self.client_id, self.client_secret)

        return self._request(method, path, headers=headers, data=data, params=params, auth=auth)

    def get(self, *args, **kwargs):
        return self.request("GET", *args, **kwargs)

    def post(self, *args, **kwargs):
        return self.request("POST", *args, **kwargs)

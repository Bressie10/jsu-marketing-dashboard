// Google Drive Picker — shared utility
// Set window.GDRIVE_API_KEY and window.GDRIVE_CLIENT_ID before calling openGDrivePicker()

const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
let _gapiLoaded = false;
let _gsiLoaded  = false;
let _tokenClient = null;
let _accessToken = null;

function _loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function _ensureGapi() {
  if (_gapiLoaded) return;
  await _loadScript('https://apis.google.com/js/api.js');
  await new Promise(resolve => gapi.load('picker', resolve));
  _gapiLoaded = true;
}

async function _ensureGsi() {
  if (_gsiLoaded) return;
  await _loadScript('https://accounts.google.com/gsi/client');
  _gsiLoaded = true;
}

async function _getToken() {
  return new Promise((resolve, reject) => {
    const cb = (resp) => {
      if (resp.error) { reject(new Error(resp.error)); return; }
      _accessToken = resp.access_token;
      resolve(_accessToken);
    };
    if (!_tokenClient) {
      _tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: window.GDRIVE_CLIENT_ID,
        scope: GDRIVE_SCOPE,
        callback: cb
      });
    } else {
      _tokenClient.callback = cb;
    }
    _tokenClient.requestAccessToken({ prompt: _accessToken ? '' : 'consent' });
  });
}

async function _downloadDriveFile(doc, token) {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${doc.id}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!resp.ok) throw new Error(`Drive download failed (${resp.status}): ${doc.name}`);
  const blob = await resp.blob();
  return new File([blob], doc.name, { type: doc.mimeType || blob.type });
}

// Main entry point
// opts: { mimeTypes: string, multiple: bool, onPick: fn(file|files), onError: fn(err) }
async function openGDrivePicker(opts = {}) {
  const { mimeTypes, multiple = false, onPick, onError } = opts;
  const fail = (err) => {
    console.error('GDrive Picker:', err);
    if (onError) onError(err);
    else alert('Google Drive error: ' + (err.message || err));
  };
  try {
    await _ensureGapi();
    await _ensureGsi();
    const token = await _getToken();

    const view = new google.picker.DocsView()
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);
    if (mimeTypes) view.setMimeTypes(mimeTypes);

    const builder = new google.picker.PickerBuilder()
      .addView(view)
      .setOAuthToken(token)
      .setDeveloperKey(window.GDRIVE_API_KEY)
      .setCallback(async (data) => {
        if (data.action !== google.picker.Action.PICKED) return;
        try {
          const files = await Promise.all(data.docs.map(d => _downloadDriveFile(d, token)));
          if (onPick) onPick(multiple ? files : files[0]);
        } catch (err) { fail(err); }
      });

    if (multiple) builder.enableFeature(google.picker.Feature.MULTISELECT_ENABLED);
    builder.build().setVisible(true);
  } catch (err) { fail(err); }
}

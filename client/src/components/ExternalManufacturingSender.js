import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ExternalManufacturingSender.css';

function buildPutBody(form) {
  const skuName = String(form.skuName || '').trim();
  return {
    manufacturing_id: form.manufacturingId,
    sku: skuName,
    sku_name: skuName,
    target_qty: Number(form.targetQty) || 0,
    done_qty: form.doneQty === '' ? 0 : Number(form.doneQty),
    status: form.putStatus || 'finished',
    manual_finished_qty: form.manualFinishedQty === '' ? 0 : Number(form.manualFinishedQty),
    leader_name: String(form.leaderName || '').trim(),
    started_at: form.startedAt.trim() === '' ? null : form.startedAt.trim(),
    finished_at: form.finishedAt.trim() === '' ? null : form.finishedAt.trim()
  };
}

function ExternalManufacturingSender() {
  const navigate = useNavigate();
  const [externalId, setExternalId] = useState('');
  const [manufacturingId, setManufacturingId] = useState('');
  const [skuName, setSkuName] = useState('');
  const [targetQty, setTargetQty] = useState('');
  const [doneQty, setDoneQty] = useState('');
  const [putStatus, setPutStatus] = useState('finished');
  const [manualFinishedQty, setManualFinishedQty] = useState('0');
  const [leaderName, setLeaderName] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [finishedAt, setFinishedAt] = useState('');
  const [patchStatus, setPatchStatus] = useState('finished');
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [lastResponse, setLastResponse] = useState(null);

  const putBody = useMemo(
    () =>
      buildPutBody({
        manufacturingId,
        skuName,
        targetQty,
        doneQty,
        putStatus,
        manualFinishedQty,
        leaderName,
        startedAt,
        finishedAt
      }),
    [
      manufacturingId,
      skuName,
      targetQty,
      doneQty,
      putStatus,
      manualFinishedQty,
      leaderName,
      startedAt,
      finishedAt
    ]
  );

  const patchBody = useMemo(() => ({ status: patchStatus }), [patchStatus]);

  const handleResolveId = async () => {
    const mo = manufacturingId.trim();
    if (!mo) {
      setMessage({ type: 'error', text: 'Isi Manufacturing ID (MO number) terlebih dahulu.' });
      return;
    }
    setResolving(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.get('/api/admin/external-manufacturing/resolve-id', {
        params: { mo_number: mo }
      });
      if (response.data.success && response.data.externalId) {
        setExternalId(response.data.externalId);
        setMessage({
          type: 'success',
          text: `External ID ditemukan (${response.data.source}): ${response.data.externalId}`
        });
      } else {
        setMessage({ type: 'error', text: 'External ID tidak ditemukan.' });
      }
    } catch (error) {
      const errText = error.response?.data?.error || error.message || 'Gagal resolve external ID';
      setMessage({ type: 'error', text: errText });
    } finally {
      setResolving(false);
    }
  };

  const sendAction = async (action) => {
    const id = externalId.trim();
    if (!id) {
      setMessage({ type: 'error', text: 'External Resource ID wajib diisi.' });
      return;
    }
    if ((action === 'put' || action === 'put_then_patch') && !manufacturingId.trim()) {
      setMessage({ type: 'error', text: 'Manufacturing ID wajib diisi untuk PUT.' });
      return;
    }
    if ((action === 'put' || action === 'put_then_patch') && !leaderName.trim()) {
      setMessage({ type: 'error', text: 'Leader Name wajib diisi untuk PUT.' });
      return;
    }
    if ((action === 'patch' || action === 'put_then_patch') && !patchStatus.trim()) {
      setMessage({ type: 'error', text: 'PATCH status wajib diisi.' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    setLastResponse(null);

    try {
      const response = await axios.post('/api/admin/external-manufacturing/send', {
        externalId: id,
        action,
        putBody: action === 'patch' ? undefined : putBody,
        patchBody: action === 'put' ? undefined : patchBody
      });
      setLastResponse(response.data);
      if (response.data.success) {
        setMessage({
          type: 'success',
          text:
            action === 'put'
              ? 'PUT berhasil dikirim ke external API.'
              : action === 'patch'
                ? 'PATCH berhasil dikirim ke external API.'
                : 'PUT lalu PATCH berhasil dikirim ke external API.'
        });
      } else {
        setMessage({ type: 'error', text: 'Request selesai dengan error. Lihat response di bawah.' });
      }
    } catch (error) {
      const payload = error.response?.data || { success: false, error: error.message };
      setLastResponse(payload);
      const errText = payload.error || payload.errors?.join('; ') || error.message || 'Gagal mengirim request';
      setMessage({ type: 'error', text: errText });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ext-mfg-sender-container">
      <header className="ext-mfg-sender-header">
        <button type="button" className="ext-mfg-btn ext-mfg-btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Kembali
        </button>
        <h1>External Manufacturing Sender</h1>
        <p className="ext-mfg-subtitle">
          Kirim manual PUT / PATCH ke FOOM dengan parameter yang sama seperti Submit MO liquid.
        </p>
      </header>

      {message.text && (
        <div className={`ext-mfg-alert ext-mfg-alert-${message.type}`}>{message.text}</div>
      )}

      <section className="ext-mfg-panel">
        <h2>Target</h2>
        <div className="ext-mfg-form-grid">
          <div className="ext-mfg-field">
            <label htmlFor="externalId">External Resource ID (UUID)</label>
            <input
              id="externalId"
              type="text"
              value={externalId}
              onChange={(e) => setExternalId(e.target.value)}
              placeholder="UUID dari external_manufacturing_map"
            />
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="manufacturingId">Manufacturing ID (MO)</label>
            <div className="ext-mfg-inline">
              <input
                id="manufacturingId"
                type="text"
                value={manufacturingId}
                onChange={(e) => setManufacturingId(e.target.value)}
                placeholder="PROD/MO/28246"
              />
              <button
                type="button"
                className="ext-mfg-btn ext-mfg-btn-secondary"
                onClick={handleResolveId}
                disabled={resolving || loading}
              >
                {resolving ? 'Resolving…' : 'Resolve ID from MO'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="ext-mfg-panel">
        <h2>PUT Body (Submit MO)</h2>
        <div className="ext-mfg-form-grid">
          <div className="ext-mfg-field">
            <label htmlFor="skuName">SKU / SKU Name</label>
            <input
              id="skuName"
              type="text"
              value={skuName}
              onChange={(e) => setSkuName(e.target.value)}
              placeholder="Nama SKU"
            />
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="leaderName">Leader Name</label>
            <input
              id="leaderName"
              type="text"
              value={leaderName}
              onChange={(e) => setLeaderName(e.target.value)}
              placeholder="Nama leader"
            />
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="targetQty">Target Qty</label>
            <input
              id="targetQty"
              type="number"
              min="0"
              value={targetQty}
              onChange={(e) => setTargetQty(e.target.value)}
            />
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="doneQty">Done Qty</label>
            <input
              id="doneQty"
              type="number"
              min="0"
              value={doneQty}
              onChange={(e) => setDoneQty(e.target.value)}
            />
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="putStatus">PUT status</label>
            <select id="putStatus" value={putStatus} onChange={(e) => setPutStatus(e.target.value)}>
              <option value="finished">finished</option>
              <option value="started">started</option>
              <option value="idle">idle</option>
            </select>
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="manualFinishedQty">Manual Finished Qty</label>
            <input
              id="manualFinishedQty"
              type="number"
              min="0"
              value={manualFinishedQty}
              onChange={(e) => setManualFinishedQty(e.target.value)}
            />
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="startedAt">Started At (opsional)</label>
            <input
              id="startedAt"
              type="text"
              value={startedAt}
              onChange={(e) => setStartedAt(e.target.value)}
              placeholder="null atau 2026-07-13T10:30:00+07:00"
            />
          </div>
          <div className="ext-mfg-field">
            <label htmlFor="finishedAt">Finished At (opsional)</label>
            <input
              id="finishedAt"
              type="text"
              value={finishedAt}
              onChange={(e) => setFinishedAt(e.target.value)}
              placeholder="null atau 2026-07-13T10:30:00+07:00"
            />
          </div>
        </div>
      </section>

      <section className="ext-mfg-panel">
        <h2>PATCH Body</h2>
        <div className="ext-mfg-form-grid ext-mfg-form-grid-narrow">
          <div className="ext-mfg-field">
            <label htmlFor="patchStatus">PATCH status</label>
            <select id="patchStatus" value={patchStatus} onChange={(e) => setPatchStatus(e.target.value)}>
              <option value="finished">finished</option>
              <option value="started">started</option>
              <option value="idle">idle</option>
            </select>
          </div>
        </div>
      </section>

      <section className="ext-mfg-panel">
        <h2>Preview</h2>
        <div className="ext-mfg-preview-grid">
          <div>
            <h3>PUT</h3>
            <pre className="ext-mfg-pre">{JSON.stringify(putBody, null, 2)}</pre>
          </div>
          <div>
            <h3>PATCH</h3>
            <pre className="ext-mfg-pre">{JSON.stringify(patchBody, null, 2)}</pre>
          </div>
        </div>
      </section>

      <section className="ext-mfg-actions">
        <button
          type="button"
          className="ext-mfg-btn ext-mfg-btn-primary"
          onClick={() => sendAction('put')}
          disabled={loading}
        >
          {loading ? 'Sending…' : 'Send PUT'}
        </button>
        <button
          type="button"
          className="ext-mfg-btn ext-mfg-btn-secondary"
          onClick={() => sendAction('patch')}
          disabled={loading}
        >
          {loading ? 'Sending…' : 'Send PATCH'}
        </button>
        <button
          type="button"
          className="ext-mfg-btn ext-mfg-btn-accent"
          onClick={() => sendAction('put_then_patch')}
          disabled={loading}
        >
          {loading ? 'Sending…' : 'Send PUT then PATCH'}
        </button>
      </section>

      {lastResponse && (
        <section className="ext-mfg-panel">
          <h2>Response</h2>
          <pre className="ext-mfg-pre ext-mfg-pre-response">
            {JSON.stringify(lastResponse, null, 2)}
          </pre>
        </section>
      )}
    </div>
  );
}

export default ExternalManufacturingSender;

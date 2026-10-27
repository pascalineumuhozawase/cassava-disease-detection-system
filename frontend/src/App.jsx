import React, { useCallback, useEffect, useState } from 'react';
import { Activity, Camera, CheckCircle2, Cloud, Database, Droplets, History, Leaf, LayoutDashboard, Menu, RefreshCw, ShieldCheck, Smartphone, Thermometer, Upload, Users, Wifi, X, Sprout, Sun, Cpu, AlertTriangle } from 'lucide-react';

const API = '/api';
const fmt = (v, digits=1) => v === null || v === undefined ? '—' : Number(v).toFixed(digits);
const dateFmt = v => v ? new Date(v).toLocaleString() : '—';

async function api(path, options={}) {
  const res = await fetch(`${API}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function App() {
  const [page, setPage] = useState('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [health, setHealth] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [readings, setReadings] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [devices, setDevices] = useState([]);
  const [users, setUsers] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [image, setImage] = useState(null);
  const [farmName, setFarmName] = useState('Demo Cassava Farm');

  const load = useCallback(async () => {
    setError('');
    try {
      const [h, d, r, p, dev, u, s] = await Promise.all([
        api('/health'), api('/dashboard'), api('/readings?limit=100'), api('/predictions?limit=100'),
        api('/devices'), api('/admin/users'), api('/admin/stats')
      ]);
      setHealth(h); setDashboard(d); setReadings(r); setPredictions(p); setDevices(dev); setUsers(u); setAdminStats(s);
    } catch (e) { setError(`${e.message}. Check that the backend and PostgreSQL are running.`); }
  }, []);
  useEffect(() => { load(); const timer = setInterval(load, 15000); return () => clearInterval(timer); }, [load]);

  const filteredPredictions = predictions.filter(p => {
    const day = new Date(p.created_at).toISOString().slice(0,10);
    return (!from || day >= from) && (!to || day <= to);
  });
  const filteredReadings = readings.filter(r => {
    const day = new Date(r.recorded_at).toISOString().slice(0,10);
    return (!from || day >= from) && (!to || day <= to);
  });

  async function submitImage(e) {
    e.preventDefault();
    if (!image) { setNotice('Choose a leaf image first.'); return; }
    const form = new FormData(); form.append('image', image); form.append('farmName', farmName);
    setBusy(true); setNotice('');
    try {
      const result = await api('/predictions', { method: 'POST', body: form });
      setNotice(`Image saved. ${result.disease_class}. ${result.notes || ''}`);
      setImage(null); e.target.reset(); await load(); setPage('history');
    } catch (e) { setNotice(e.message); }
    finally { setBusy(false); }
  }

  const nav = [
    ['dashboard', 'Dashboard', LayoutDashboard],
    ['capture', 'Analyze leaf', Camera],
    ['history', 'History', History],
    ['devices', 'Sensors & devices', Activity],
    ['admin', 'Administration', ShieldCheck]
  ];
  const latest = dashboard?.latestReading;
  const title = nav.find(n => n[0] === page)?.[1] || 'Dashboard';

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="brand"><div className="brand-icon"><Leaf size={25}/></div><div><b>CassavaCare</b><small>Disease Detection System</small></div><button className="mobile-close" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>
      <div className="farm-switch"><span className="online-dot"/><div><small>ACTIVE FARM</small><b>Demo Cassava Farm</b></div></div>
      <nav>{nav.map(([id, label, Icon]) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => {setPage(id);setMenuOpen(false);}}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><div className="sensor-mini"><Wifi size={18}/><div><b>{health?.database === 'connected' ? 'Backend connected' : 'Connection pending'}</b><small>{health?.database === 'connected' ? 'PostgreSQL available' : 'Check server / database'}</small></div></div><small className="version">Prototype • v1.0</small></div>
    </aside>

    <main className="main">
      <header className="topbar"><button className="menu-toggle" onClick={() => setMenuOpen(true)}><Menu/></button><div><div className="eyebrow">CASSAVA HEALTH MONITORING</div><h1>{title}</h1></div><div className="top-actions"><span className={`status-pill ${health?.database === 'connected' ? 'good' : 'bad'}`}><span className="status-dot"/>{health?.database === 'connected' ? 'System online' : 'Disconnected'}</span><button className="icon-button" onClick={load} title="Refresh"><RefreshCw size={18}/></button></div></header>

      {error && <div className="alert error"><AlertTriangle size={18}/><span>{error}</span></div>}
      {notice && <div className="alert info"><CheckCircle2 size={18}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}

      {page === 'dashboard' && <section className="page-content">
        <div className="welcome"><div><span className="welcome-tag"><Sprout size={14}/> FIELD OVERVIEW</span><h2>Healthier cassava starts with early detection.</h2><p>Monitor field conditions, upload leaf images, and review observations from one place.</p></div><div className="welcome-art"><Leaf size={80}/></div></div>
        {health?.predictionMode === 'demo' && <div className="alert warning"><AlertTriangle size={18}/><span><b>Demo AI mode:</b> uploads are stored, but no trained disease classifier is connected. Predictions are clearly marked as demo.</span></div>}
        <div className="stat-grid">
          <Stat icon={Camera} label="Images analyzed" value={dashboard?.totalPredictions ?? '—'} hint="Saved prediction records" color="green"/>
          <Stat icon={Activity} label="Sensor readings" value={readings.length} hint="Latest 100 records" color="blue"/>
          <Stat icon={Wifi} label="Online devices" value={`${dashboard?.devices?.online ?? 0} / ${dashboard?.devices?.total ?? 0}`} hint="Last device heartbeat" color="purple"/>
          <Stat icon={Database} label="Database" value={health?.database === 'connected' ? 'Connected' : 'Offline'} hint="PostgreSQL connection" color="orange"/>
        </div>
        <div className="content-grid">
          <div className="panel"><div className="panel-head"><div><h3>Latest sensor readings</h3><p>Most recent field measurement</p></div><button className="text-button" onClick={() => setPage('devices')}>View devices →</button></div>
            <div className="sensor-cards"><Metric icon={Thermometer} label="Temperature" value={fmt(latest?.temperature)} unit="°C"/><Metric icon={Droplets} label="Humidity" value={fmt(latest?.humidity)} unit="%"/><Metric icon={Sprout} label="Soil moisture" value={fmt(latest?.soil_moisture)} unit="%"/><Metric icon={Sun} label="Light intensity" value={fmt(latest?.light_intensity,0)} unit="lux"/></div>
            <div className="last-updated">Last update: {dateFmt(latest?.recorded_at)}</div>
          </div>
          <div className="panel"><div className="panel-head"><div><h3>Recent image checks</h3><p>Latest saved records</p></div><button className="text-button" onClick={() => setPage('history')}>Full history →</button></div>
            {predictions.slice(0,4).length ? predictions.slice(0,4).map(p => <div className="recent-row" key={p.id}><div className="recent-icon"><Leaf size={18}/></div><div className="recent-main"><b>{p.disease_class}</b><small>{p.farm_name || 'Farm not specified'} · {dateFmt(p.created_at)}</small></div><span className="confidence">{Math.round(Number(p.confidence)*100)}%</span></div>) : <Empty text="No leaf images submitted yet. Start by analyzing a leaf image."/>}
          </div>
        </div>
        <div className="quick-actions"><button className="primary-button" onClick={() => setPage('capture')}><Camera size={18}/> Analyze a leaf</button><button className="secondary-button" onClick={() => setPage('history')}><History size={18}/> Open history</button></div>
      </section>}

      {page === 'capture' && <section className="page-content narrow">
        <div className="section-intro"><span className="welcome-tag"><Camera size={14}/> IMAGE ANALYSIS</span><h2>Upload a cassava leaf photo</h2><p>Use a clear, well-lit photo showing the leaf surface. The image will be saved and sent through the prediction adapter.</p></div>
        <form className="panel upload-panel" onSubmit={submitImage}>
          <label className="field-label">Farm name<input value={farmName} onChange={e => setFarmName(e.target.value)} placeholder="e.g. Demo Cassava Farm"/></label>
          <label className="dropzone">{image ? <><CheckCircle2 size={34}/><b>{image.name}</b><span>{(image.size/1024/1024).toFixed(2)} MB selected</span></> : <><Upload size={36}/><b>Choose a leaf image</b><span>JPEG, PNG or WEBP · Maximum 8 MB</span></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)}/></label>
          <label className="camera-choice"><Camera size={18}/><span><b>Take a photo with your smartphone</b><small>Opens the rear camera on supported phones</small></span><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => setImage(e.target.files?.[0] || null)}/></label>
          {image && <img className="image-preview" src={URL.createObjectURL(image)} alt="Selected cassava leaf preview"/>}
          <div className="alert warning"><AlertTriangle size={18}/><span>AI status: demo adapter only. A real disease classification requires a trained and validated model.</span></div>
          <button className="primary-button full" disabled={busy || !image}>{busy ? 'Uploading…' : <><Camera size={18}/> Upload and save</>}</button>
        </form>
      </section>}

      {page === 'history' && <section className="page-content">
        <div className="section-intro"><h2>Observation history</h2><p>Filter saved leaf-image records and sensor readings by date.</p></div>
        <DateFilters from={from} to={to} setFrom={setFrom} setTo={setTo}/>
        <div className="panel table-panel"><div className="panel-head"><div><h3>Leaf image predictions</h3><p>{filteredPredictions.length} record(s)</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Farm</th><th>Image</th><th>Result</th><th>Confidence</th><th>Mode</th></tr></thead><tbody>{filteredPredictions.map(p => <tr key={p.id}><td>{dateFmt(p.created_at)}</td><td>{p.farm_name || '—'}</td><td>{p.image_path ? <a href={p.image_path} target="_blank" rel="noreferrer">View image</a> : '—'}</td><td>{p.disease_class}</td><td>{Math.round(Number(p.confidence)*100)}%</td><td><span className="tiny-pill">{p.model_mode}</span></td></tr>)}</tbody></table>{!filteredPredictions.length && <Empty text="No prediction records for this date range."/ >}</div></div>
        <div className="panel table-panel"><div className="panel-head"><div><h3>Sensor history</h3><p>{filteredReadings.length} record(s)</p></div></div><div className="table-scroll"><table><thead><tr><th>Date</th><th>Device</th><th>Temperature</th><th>Humidity</th><th>Soil moisture</th><th>Light</th></tr></thead><tbody>{filteredReadings.map(r => <tr key={r.id}><td>{dateFmt(r.recorded_at)}</td><td>{r.device_id}</td><td>{fmt(r.temperature)} °C</td><td>{fmt(r.humidity)}%</td><td>{fmt(r.soil_moisture)}%</td><td>{fmt(r.light_intensity,0)} lux</td></tr>)}</tbody></table>{!filteredReadings.length && <Empty text="No sensor readings for this date range. Connect an ESP32 or submit a test reading."/ >}</div></div>
      </section>}

      {page === 'devices' && <section className="page-content">
        <div className="section-intro"><h2>Sensors and devices</h2><p>Review ESP32 nodes and their latest reported measurements.</p></div>
        <div className="device-grid">{devices.map(d => <div className="panel device-card" key={d.device_id}><div className="device-top"><div className="device-symbol"><Cpu size={25}/></div><span className={`tiny-pill ${d.status === 'online' ? 'online' : ''}`}>{d.status}</span></div><h3>{d.name}</h3><p>{d.device_id}</p><div className="device-metrics"><span>Temp. <b>{fmt(d.temperature)}°C</b></span><span>Humidity <b>{fmt(d.humidity)}%</b></span><span>Soil <b>{fmt(d.soil_moisture)}%</b></span><span>Light <b>{fmt(d.light_intensity,0)} lux</b></span></div><small>Last heartbeat: {dateFmt(d.last_seen)}</small></div>)}</div>
        <div className="panel manual-panel"><h3>Test connection (optional)</h3><p>Send a sample reading to confirm the frontend, backend, and database connection. This is test data, not a physical sensor measurement.</p><button className="secondary-button" onClick={async () => {try {await api('/readings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:'ESP32-001',temperature:26.8,humidity:71.2,soilMoisture:45,lightIntensity:680})});setNotice('Sample reading saved. It is labelled as test data in this action; connect hardware for real readings.');await load();}catch(e){setNotice(e.message);}}}><Activity size={18}/> Send sample reading</button></div>
      </section>}

      {page === 'admin' && <section className="page-content">
        <div className="section-intro"><span className="welcome-tag"><ShieldCheck size={14}/> ADMINISTRATION</span><h2>System overview</h2><p>Starter admin view for registered users, farms, devices, and collected data. Authentication is not implemented in this prototype.</p></div>
        <div className="stat-grid admin-stats">{[['Users',adminStats?.users,Users],['Farms',adminStats?.farms,Sprout],['Devices',adminStats?.devices,Cpu],['Readings',adminStats?.readings,Activity],['Predictions',adminStats?.predictions,Camera]].map(([label,value,Icon])=><Stat key={label} icon={Icon} label={label} value={value ?? '—'} hint="Database total" color="green"/>)}</div>
        <div className="panel table-panel"><div className="panel-head"><div><h3>Registered users</h3><p>Seeded demo accounts — login is not enabled</p></div></div><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Farm</th><th>Created</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.full_name}</td><td>{u.email}</td><td><span className="tiny-pill">{u.role}</span></td><td>{u.farm_name || '—'}</td><td>{dateFmt(u.created_at)}</td></tr>)}</tbody></table></div></div>
        <div className="alert warning"><ShieldCheck size={18}/><span>Before real deployment, add authentication, role-based authorization, secure file validation, HTTPS, and audit logs. Do not expose admin routes publicly as-is.</span></div>
      </section>}
      <footer className="footer"><span><Leaf size={15}/> CassavaCare</span><span>Smart technology · Healthy crops · Rwanda</span><span>{health?.database === 'connected' ? 'Connected to API' : 'Waiting for connection'}</span></footer>
    </main>
  </div>;
}

function Stat({icon:Icon,label,value,hint,color}) { return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={20}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-hint">{hint}</div></div>; }
function Metric({icon:Icon,label,value,unit}) { return <div className="metric"><div className="metric-icon"><Icon size={20}/></div><div><small>{label}</small><b>{value} <span>{unit}</span></b></div></div>; }
function Empty({text}) { return <div className="empty"><Leaf size={24}/><p>{text}</p></div>; }
function DateFilters({from,to,setFrom,setTo}) { return <div className="filters"><label>From date<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>To date<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><button className="secondary-button" onClick={()=>{setFrom('');setTo('');}}>Clear dates</button></div>; }

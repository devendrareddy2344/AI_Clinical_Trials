import React, { useState, useEffect } from 'react';
import { Upload, FileText, User, CheckCircle2, XCircle, AlertTriangle, Shield, Info, Activity, Database, ArrowRight, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const App = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [protocol, setProtocol] = useState(null);
  const [patient, setPatient] = useState(null);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchSummary, setBatchSummary] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [signupSuccess, setSignupSuccess] = useState(false);

  // Database state
  const [protocolsList, setProtocolsList] = useState([]);
  const [patientsList, setPatientsList] = useState([]);
  const [dbLoading, setDbLoading] = useState(false);

  useEffect(() => {
    fetchDatabaseData();
  }, []);

  const fetchDatabaseData = async () => {
    setDbLoading(true);
    try {
      const [protocolsRes, patientsRes] = await Promise.all([
        axios.get('http://localhost:8000/api/protocols/'),
        axios.get('http://localhost:8000/api/patients/')
      ]);
      setProtocolsList(protocolsRes.data);
      setPatientsList(patientsRes.data);
    } catch (error) {
      console.error("Error fetching sample data:", error);
    } finally {
      setDbLoading(false);
    }
  };

  const handleProtocolUpload = (e) => setProtocol(e.target.files[0]);
  const handlePatientUpload = (e) => setPatient(e.target.files[0]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      const formData = new FormData();
      formData.append('username', loginForm.username);
      formData.append('password', loginForm.password);

      const response = await axios.post('http://localhost:8000/api/auth/login', formData);
      if (response.data.access_token) {
        setIsLoggedIn(true);
        localStorage.setItem('isLoggedIn', 'true');
      }
    } catch (error) {
      setLoginError('Invalid credentials. Hint: use admin/admin');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('isLoggedIn');
    setActiveTab('dashboard');
    setResults(null);
    setBatchSummary(null);
    setAuthMode('login');
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');
    try {
      await axios.post('http://localhost:8000/api/auth/signup', loginForm);
      setSignupSuccess(true);
      setAuthMode('login');
      alert("Account created successfully! Please login.");
    } catch (error) {
      setLoginError(error.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async (selectedPatient = null, selectedProtocol = null) => {
    const finalProtocol = selectedProtocol || protocol;
    const finalPatient = selectedPatient || patient;

    if (!finalProtocol || !finalPatient) return alert("Please upload or select both protocol and patient profile");

    setLoading(true);
    setActiveTab('dashboard'); // Switch to dashboard to see results
    try {
      let protocolData;

      // Fix: Check if protocol is from DB (has inclusion_criteria) or a File
      if (finalProtocol.inclusion_criteria) {
        protocolData = {
          id: finalProtocol.id,
          sections: {
            inclusion: Array.isArray(finalProtocol.inclusion_criteria) ? finalProtocol.inclusion_criteria.join('\n') : finalProtocol.inclusion_criteria,
            exclusion: Array.isArray(finalProtocol.exclusion_criteria) ? finalProtocol.exclusion_criteria.join('\n') : finalProtocol.exclusion_criteria
          }
        };
      } else if (finalProtocol.sections) {
        protocolData = finalProtocol;
      } else {
        // It's a raw File object, needs upload
        const protocolFormData = new FormData();
        protocolFormData.append('file', finalProtocol);
        const protocolRes = await axios.post('http://localhost:8000/api/protocols/upload', protocolFormData);
        protocolData = protocolRes.data;
      }

      let patientProfile;
      if (finalPatient.lab_results) {
        // Already a structured profile or DB record
        patientProfile = finalPatient;
      } else {
        // It's a raw File object (PDF or JSON)
        const patientFormData = new FormData();
        patientFormData.append('file', finalPatient);

        // Use either the upload-file or normalize endpoint based on file type
        const isUploadFile = finalPatient.name.endsWith('.pdf') ||
          finalPatient.name.endsWith('.xlsx') ||
          finalPatient.name.endsWith('.xls');

        const endpoint = isUploadFile
          ? 'http://localhost:8000/api/patients/upload'
          : 'http://localhost:8000/api/patients/normalize';

        const patientRes = await axios.post(endpoint, patientFormData);
        patientProfile = patientRes.data;
      }

      const eligibilityRes = await axios.post('http://localhost:8000/api/eligibility/evaluate', {
        patient_id: patientProfile.id,
        protocol_id: protocolData.id,
        patient_profile: patientProfile,
        protocol_data: protocolData
      });

      setResults(eligibilityRes.data);
      setBatchSummary(null); // Clear bulk summary when doing single check
      fetchDatabaseData(); // Refresh list to show recorded result
    } catch (error) {
      console.error(error);
      alert("Error running analysis. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const runBulkAnalysis = async () => {
    if (!protocol || patientsList.length === 0) return alert("Select a protocol and ensure patients are in Database");

    setLoading(true);
    setResults(null);
    let eligibleNames = [];
    let eligibleCount = 0;

    try {
      let protocolData;
      if (protocol.inclusion_criteria) {
        protocolData = {
          id: protocol.id,
          sections: {
            inclusion: Array.isArray(protocol.inclusion_criteria) ? protocol.inclusion_criteria.join('\n') : protocol.inclusion_criteria,
            exclusion: Array.isArray(protocol.exclusion_criteria) ? protocol.exclusion_criteria.join('\n') : protocol.exclusion_criteria
          }
        };
      } else {
        const protocolFormData = new FormData();
        protocolFormData.append('file', protocol);
        const protocolRes = await axios.post('http://localhost:8000/api/protocols/upload', protocolFormData);
        protocolData = protocolRes.data;
      }

      // Execute matches in parallel for speed
      const matchPromises = patientsList.map(p =>
        axios.post('http://localhost:8000/api/eligibility/evaluate', {
          patient_id: p.id,
          protocol_id: protocolData.id,
          patient_profile: p,
          protocol_data: protocolData
        })
      );

      const allMatches = await Promise.all(matchPromises);

      allMatches.forEach((res, index) => {
        if (res.data.is_eligible) {
          eligibleNames.push(patientsList[index].name);
          eligibleCount++;
        }
      });

      setBatchSummary({
        total: patientsList.length,
        eligible: eligibleCount,
        ineligible: patientsList.length - eligibleCount,
        names: eligibleNames
      });

      fetchDatabaseData();
    } catch (error) {
      console.error(error);
      alert("Bulk analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/eligibility/export', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'eligibility_results.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Export failed:", error);
      alert("Failed to export Excel file.");
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full bg-[#0f172a] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md glass border border-white/10 rounded-[2.5rem] p-12 shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center gap-6 mb-10">
            <div className="bg-primary-500 p-4 rounded-3xl text-white shadow-2xl shadow-primary-500/40">
              <Shield size={40} />
            </div>
            <div className="text-center">
              <h1 className="text-3xl font-black tracking-tight text-white mb-2">Clynix Intelligence</h1>
              <p className="text-slate-400 font-medium">
                {authMode === 'login' ? 'Please sign in to access insights' : 'Create your secure account'}
              </p>
            </div>
          </div>

          <form onSubmit={authMode === 'login' ? handleLogin : handleSignup} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Username</label>
              <input
                type="text"
                required
                className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                placeholder="Enter username"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <input
                type="password"
                required
                className="bg-slate-900/50 border border-white/10 rounded-2xl p-4 text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                placeholder="••••••••"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
              />
            </div>

            {loginError && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-rose-400 text-xs font-bold text-center bg-rose-400/10 p-3 rounded-xl border border-rose-400/20"
              >
                {loginError}
              </motion.p>
            )}

            <button
              disabled={loading}
              className="w-full py-4 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl text-white font-bold text-lg shadow-xl shadow-primary-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
            >
              {loading ? "Processing..." : (authMode === 'login' ? "Sign In" : "Create Account")}
            </button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-slate-500">{authMode === 'login' ? "Don't have an account?" : "Already have an account?"}</span>
            <button
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setLoginError('');
              }}
              className="ml-2 text-primary-400 font-bold hover:text-primary-300 transition-colors"
            >
              {authMode === 'login' ? "Register Now" : "Login Instead"}
            </button>
          </div>

          <p className="text-center mt-8 text-slate-500 text-[10px] uppercase font-bold tracking-widest">
            © 2024 Clynix Bio-Medical Data Systems
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-72 glass border-r border-white/10 p-8 flex flex-col gap-10">
        <div className="flex items-center gap-4">
          <div className="bg-primary-500 p-2.5 rounded-2xl text-white shadow-xl shadow-primary-500/40">
            <Shield size={28} />
          </div>
          <h1 className="font-bold text-2xl tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Clynix AI</h1>
        </div>

        <nav className="flex flex-col gap-3">
          <NavItem
            icon={<Activity size={20} />}
            label="Analytics Dashboard"
            active={activeTab === 'dashboard'}
            onClick={() => setActiveTab('dashboard')}
          />
          <NavItem
            icon={<FileText size={20} />}
            label="Trial Protocols"
            active={activeTab === 'protocols'}
            onClick={() => setActiveTab('protocols')}
          />
          <NavItem
            icon={<User size={20} />}
            label="Patient Profiles"
            active={activeTab === 'patients'}
            onClick={() => setActiveTab('patients')}
          />
        </nav>

        <div className="mt-auto space-y-6">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between px-5 py-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-2xl transition-all border border-rose-500/10 group"
          >
            <div className="flex items-center gap-4">
              <div className="p-1 bg-rose-500 rounded-lg text-white group-hover:scale-110 transition-transform">
                <ArrowRight size={14} className="rotate-180" />
              </div>
              <span className="text-sm font-bold">Sign Out</span>
            </div>
          </button>

          <div className="glass p-4 rounded-2xl bg-white/5 border border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Live Database</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Database size={14} className="text-primary-400" />
                <span className="text-xs text-slate-300">{protocolsList.length} Trials Synced</span>
              </div>
              <div className="flex items-center gap-2">
                <User size={14} className="text-indigo-400" />
                <span className="text-xs text-slate-300">{patientsList.length} Patient Samples</span>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-10 flex flex-col gap-10">
        <header className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold text-white mb-1">
              {activeTab === 'dashboard' ? 'Eligibility Intelligence' :
                activeTab === 'protocols' ? 'Protocol Repository' : 'Patient Explorer'}
            </h2>
            <p className="text-slate-400 font-medium">Real-time matching against sample clinical data</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={exportToExcel}
              className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-xl transition-all border border-emerald-500/20 flex items-center gap-2 text-sm font-bold shadow-lg shadow-emerald-500/10"
            >
              <Download size={16} /> Export Excel
            </button>
            <button
              onClick={fetchDatabaseData}
              className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-all border border-white/10 flex items-center gap-2 text-sm"
            >
              <Database size={16} /> Sync Database
            </button>
          </div>
        </header>

        <div className="flex-1 min-h-0">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-12 gap-10 h-full"
              >
                {/* Input Panel */}
                <section className="col-span-4 flex flex-col gap-8">
                  <div className="glass rounded-[2rem] p-8 flex flex-col gap-6 shadow-2xl">
                    <h3 className="font-bold text-lg flex items-center gap-3">
                      <div className="w-1 h-6 bg-primary-500 rounded-full" />
                      Quick Analysis
                    </h3>

                    <div className="space-y-6">
                      <div className="flex flex-col gap-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Select Protocol</label>
                        <select
                          className="bg-slate-900 border border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                          onChange={(e) => setProtocol(protocolsList.find(p => p.id === e.target.value))}
                        >
                          <option value="">Choose from DB...</option>
                          {protocolsList.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                        </select>
                        <div className="relative group">
                          <div className="border-2 border-dashed border-slate-700/50 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary-500/50 transition-all cursor-pointer">
                            <Upload size={16} className="text-slate-500" />
                            <span className="text-[10px] text-slate-400 font-medium">{protocol?.name || "Or Upload New PDF"}</span>
                            <input type="file" onChange={handleProtocolUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">Select Patient</label>
                        <select
                          className="bg-slate-900 border border-white/10 rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                          onChange={(e) => setPatient(patientsList.find(p => p.id === e.target.value))}
                        >
                          <option value="">Choose from DB...</option>
                          {patientsList.map(p => <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>)}
                        </select>
                        <div className="relative group">
                          <div className="border-2 border-dashed border-slate-700/50 rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary-500/50 transition-all cursor-pointer">
                            <Upload size={16} className="text-slate-500" />
                            <span className="text-[10px] text-slate-400 font-medium">{patient?.name || "Or Upload Patient PDF/Excel"}</span>
                            <input type="file" onChange={handlePatientUpload} className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.json,.xlsx,.xls" />
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => runBulkAnalysis()}
                      disabled={loading || !protocol}
                      className={`w-full py-3 rounded-xl font-bold text-sm border border-primary-500/30 text-primary-400 hover:bg-primary-500/10 transition-all mb-2 ${loading ? 'opacity-50' : ''}`}
                    >
                      {loading ? "Matching Batch..." : "Match All Patients in DB"}
                    </button>

                    <button
                      onClick={() => runAnalysis()}
                      disabled={loading}
                      className={`w-full py-4 rounded-2xl font-bold text-lg shadow-2xl transition-all ${loading ? 'bg-slate-700 cursor-not-allowed' : 'bg-gradient-to-br from-primary-500 to-indigo-600 hover:scale-[1.02] active:scale-[0.98]'}`}
                    >
                      {loading ? "Computing Match..." : "Start Single Match"}
                    </button>
                  </div>
                </section>

                {/* Results Panel */}
                <section className="col-span-8 overflow-y-auto pr-2 custom-scrollbar">
                  {batchSummary && (
                    <motion.div
                      initial={{ opacity: 0, y: -20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-indigo-500/10 border border-indigo-500/20 rounded-[2.5rem] p-10 mb-8 relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 p-6 opacity-10">
                        <Activity size={120} />
                      </div>
                      <h3 className="text-2xl font-black mb-8 flex items-center gap-3">
                        <Database size={24} className="text-indigo-400" /> Batch Match Results
                      </h3>

                      <div className="grid grid-cols-3 gap-8 mb-10">
                        <div className="bg-slate-900/50 p-6 rounded-3xl border border-white/5">
                          <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Total Screened</p>
                          <p className="text-4xl font-black text-white">{batchSummary.total}</p>
                        </div>
                        <div className="bg-emerald-500/5 p-6 rounded-3xl border border-emerald-500/20">
                          <p className="text-emerald-500 text-[10px] uppercase font-black tracking-widest mb-1">Eligible</p>
                          <p className="text-4xl font-black text-emerald-400">{batchSummary.eligible}</p>
                        </div>
                        <div className="bg-rose-500/5 p-6 rounded-3xl border border-rose-500/20">
                          <p className="text-rose-500 text-[10px] uppercase font-black tracking-widest mb-1">Not Eligible</p>
                          <p className="text-4xl font-black text-rose-400">{batchSummary.ineligible}</p>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-2">Selected Candidates:</p>
                        <div className="flex flex-wrap gap-2">
                          {batchSummary.names.length > 0 ? batchSummary.names.map((name, i) => (
                            <span key={i} className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/20 flex items-center gap-2">
                              <CheckCircle2 size={12} /> {name}
                            </span>
                          )) : <p className="text-slate-500 italic text-sm ml-2">No patients met all criteria for this trial.</p>}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {results ? (
                    <div className="flex flex-col gap-8 h-full">
                      <div className={`glass rounded-[2rem] p-8 border-l-8 ${results.is_eligible ? 'border-emerald-500' : 'border-rose-500'}`}>
                        <div className="flex items-start gap-6">
                          <div className={`p-4 rounded-3xl ${results.is_eligible ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {results.is_eligible ? <CheckCircle2 size={42} /> : <XCircle size={42} />}
                          </div>
                          <div>
                            <h3 className="text-3xl font-bold mb-1">{results.is_eligible ? "Eligible" : "Ineligible"}</h3>
                            <p className="text-slate-400 italic font-medium">"{results.explanation}"</p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-8 flex-1 min-h-0">
                        <div className="glass rounded-[2rem] p-6 overflow-y-auto space-y-4">
                          <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest pl-2 mb-4">Inclusion Matches</h4>
                          {results.inclusion_matches.map((m, i) => (
                            <div key={i} className="bg-white/5 p-4 rounded-xl border border-white/5">
                              <p className="font-bold text-sm mb-1">{m.criterion}</p>
                              <p className="text-xs text-slate-400">{m.value}</p>
                            </div>
                          ))}
                        </div>
                        <div className="glass rounded-[2rem] p-6 overflow-y-auto space-y-4">
                          <h4 className="text-xs font-bold text-rose-500 uppercase tracking-widest pl-2 mb-4">Exclusion Triggers</h4>
                          {results.exclusion_conflicts.map((c, i) => (
                            <div key={i} className="bg-rose-500/5 p-4 rounded-xl border border-rose-500/10">
                              <p className="font-bold text-sm text-rose-400 mb-1">{c.criterion}</p>
                              <p className="text-xs text-slate-300">{c.explanation}</p>
                            </div>
                          ))}
                          {results.silent_triggers.map((s, i) => (
                            <div key={i + 's'} className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                              <p className="text-[10px] text-amber-500 font-black mb-1">SILENT CONTRADICTION</p>
                              <p className="font-bold text-sm mb-1">{s.trigger}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{s.source}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full glass rounded-[3rem] flex items-center justify-center p-20 text-center opacity-60">
                      <div className="flex flex-col items-center gap-6">
                        <Activity size={80} className="text-slate-700" />
                        <p className="text-xl font-medium text-slate-400 max-w-xs">Select data from the DB or upload files to begin analysis.</p>
                      </div>
                    </div>
                  )}
                </section>
              </motion.div>
            )}

            {activeTab === 'protocols' && (
              <motion.div
                key="protocols"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-3 gap-8"
              >
                {protocolsList.map(p => (
                  <div key={p.id} className="glass rounded-3xl p-6 hover:bg-white/[0.04] transition-all group">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-primary-500/10 text-primary-400 rounded-2xl">
                        <FileText size={24} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase">Trial ID: {p.id}</p>
                        <h4 className="font-bold truncate text-lg">{p.title}</h4>
                      </div>
                    </div>
                    <div className="space-y-2 mb-6 opacity-60">
                      <p className="text-xs font-medium">• {p.inclusion_criteria?.length || 0} Inclusion Rules</p>
                      <p className="text-xs font-medium">• {p.exclusion_criteria?.length || 0} Exclusion Rules</p>
                    </div>
                    <button
                      onClick={() => { setProtocol(p); setActiveTab('dashboard'); }}
                      className="w-full py-3 bg-white/5 rounded-xl text-xs font-bold hover:bg-primary-500 transition-colors flex items-center justify-center gap-2"
                    >
                      Identify Participants <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === 'patients' && (
              <motion.div
                key="patients"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="grid grid-cols-4 gap-8"
              >
                {patientsList.map(pt => (
                  <div key={pt.id} className="glass rounded-3xl p-6 border border-white/5 hover:border-primary-500/30 transition-all">
                    <div className="flex flex-col items-center text-center gap-3">
                      <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border-4 border-white/5">
                        <User size={32} className="text-slate-500" />
                      </div>
                      <div>
                        <h4 className="font-bold">{pt.name}</h4>
                        <p className="text-[10px] text-primary-400 font-bold uppercase tracking-tighter">ID: {pt.id}</p>
                      </div>
                      <div className="flex gap-2 mb-4">
                        <span className="bg-white/5 px-2 py-1 rounded-md text-[10px] font-bold text-slate-400">AGE {pt.age}</span>
                        <span className="bg-white/5 px-2 py-1 rounded-md text-[10px] font-bold text-slate-400 uppercase">{pt.gender}</span>
                      </div>
                      <div className="w-full text-left bg-black/20 p-3 rounded-xl mb-4">
                        <p className="text-[9px] font-black text-slate-600 uppercase mb-1">Conditions</p>
                        <p className="text-[10px] font-medium truncate">{pt.conditions?.join(', ')}</p>
                      </div>
                      <button
                        onClick={() => { setPatient(pt); setActiveTab('dashboard'); }}
                        className="w-full py-3 bg-primary-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary-500 transition-colors"
                      >
                        Check Eligibility
                      </button>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main >
    </div >
  );
};

const NavItem = ({ icon, label, active = false, onClick }) => (
  <div
    onClick={onClick}
    className={`flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer transition-all ${active ? 'bg-primary-500 text-white shadow-xl shadow-primary-500/30 font-bold scale-[1.02]' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200 font-medium'}`}
  >
    {icon}
    <span className="text-sm tracking-tight">{label}</span>
  </div>
);

export default App;

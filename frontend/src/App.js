// frontend/src/App.js - Enhanced with Threshold Control
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import Interview from './components/Interview';
import apiService from './services/api';
import audioService from './services/audioService';
import { 
  GRADIENTS, 
  INTERVIEW_STATES, 
  BROWSER_SUPPORT, 
  ERROR_MESSAGES,
  STORAGE_KEYS 
} from './utils/constants';

// =========================
// CANDIDATE SELECTION WITH THRESHOLD
// =========================
const CandidateSelection = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [threshold, setThreshold] = useState(7);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCandidates();
    checkBrowserSupport();
    
    // Load saved threshold
    const savedThreshold = localStorage.getItem('interview_threshold');
    if (savedThreshold) {
      setThreshold(parseInt(savedThreshold));
    }
  }, []);

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const data = await apiService.fetchCandidates();
      setCandidates(data);
    } catch (error) {
      console.error('Error fetching candidates:', error);
      setError('Failed to load candidates. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const checkBrowserSupport = () => {
    const support = BROWSER_SUPPORT.checkSupport();
    if (!support.isSupported) {
      setError(`Browser not fully supported. ${support.recommendations.join(' ')}`);
    }
  };

  const handleStartInterview = () => {
    if (selectedCandidate) {
      localStorage.setItem(STORAGE_KEYS.CANDIDATE_ID, selectedCandidate);
      localStorage.setItem('interview_threshold', threshold.toString());
      navigate(`/candidate/${selectedCandidate}/consent`);
    }
  };

  const handleThresholdChange = (value) => {
    const newThreshold = Math.max(1, Math.min(10, parseInt(value) || 7));
    setThreshold(newThreshold);
    localStorage.setItem('interview_threshold', newThreshold.toString());
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: GRADIENTS.main,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '50px',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)',
        maxWidth: '650px',
        width: '100%'
      }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{
            fontSize: '3rem',
            fontWeight: '800',
            background: GRADIENTS.interview,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '15px'
          }}>
            AI Interviewer
          </h1>
          <p style={{ color: '#6b7280', fontSize: '1.2rem', margin: 0 }}>
            Voice-Powered Interview System v6.0
          </p>
        </div>

        {error && (
          <div style={{
            background: '#fef2f2',
            border: '2px solid #fca5a5',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '25px',
            color: '#b91c1c'
          }}>
            <strong>⚠️ Error:</strong> {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '5px solid #e5e7eb',
              borderTop: '5px solid #667eea',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 25px'
            }} />
            <p style={{ color: '#6b7280', fontSize: '16px' }}>Loading candidates...</p>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{
                color: '#374151',
                marginBottom: '15px',
                fontSize: '1.1rem',
                fontWeight: '600'
              }}>
                Select Candidate Profile
              </h3>
              
              {candidates.length > 0 ? (
                <select
                  value={selectedCandidate}
                  onChange={(e) => setSelectedCandidate(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '16px 20px',
                    fontSize: '16px',
                    border: '2px solid #e5e7eb',
                    borderRadius: '12px',
                    background: 'white',
                    color: '#374151',
                    cursor: 'pointer',
                    transition: 'border-color 0.3s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                >
                  <option value="">Choose a candidate...</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.personal_information?.name || candidate.id}
                    </option>
                  ))}
                </select>
              ) : (
                <div style={{
                  background: '#fef3c7',
                  border: '2px solid #fbbf24',
                  borderRadius: '12px',
                  padding: '25px',
                  color: '#92400e',
                  textAlign: 'center'
                }}>
                  <p style={{ margin: '0 0 10px 0', fontWeight: '600' }}>No candidates found</p>
                  <p style={{ margin: 0, fontSize: '14px' }}>Please add candidates to the database.</p>
                </div>
              )}
            </div>

            {/* Threshold Control */}
            <div style={{
              background: '#f9fafb',
              padding: '25px',
              borderRadius: '16px',
              marginBottom: '30px',
              border: '2px solid #e5e7eb'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px'
              }}>
                <h3 style={{
                  color: '#374151',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  margin: 0
                }}>
                  Score Threshold
                </h3>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  padding: '8px 20px',
                  borderRadius: '20px',
                  fontSize: '18px',
                  fontWeight: '700',
                  minWidth: '60px',
                  textAlign: 'center'
                }}>
                  {threshold}
                </div>
              </div>
              
              <input
                type="range"
                min="1"
                max="10"
                value={threshold}
                onChange={(e) => handleThresholdChange(e.target.value)}
                style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  background: `linear-gradient(to right, #667eea 0%, #667eea ${(threshold - 1) * 11.11}%, #e5e7eb ${(threshold - 1) * 11.11}%, #e5e7eb 100%)`,
                  outline: 'none',
                  cursor: 'pointer',
                  marginBottom: '10px'
                }}
              />
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#9ca3af',
                marginBottom: '15px'
              }}>
                <span>1 (Lowest)</span>
                <span>10 (Highest)</span>
              </div>
              
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#6b7280',
                lineHeight: '1.5'
              }}>
                Candidates must score <strong style={{ color: '#667eea' }}>{threshold} or higher</strong> to pass each question. 
                Scores below this will trigger follow-up questions.
              </p>
            </div>

            <button
              onClick={handleStartInterview}
              disabled={!selectedCandidate}
              style={{
                background: selectedCandidate ? GRADIENTS.success : '#9ca3af',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                padding: '18px 32px',
                fontSize: '17px',
                fontWeight: '700',
                cursor: selectedCandidate ? 'pointer' : 'not-allowed',
                transition: 'all 0.3s ease',
                width: '100%',
                transform: selectedCandidate ? 'translateY(0)' : 'none',
                boxShadow: selectedCandidate ? '0 10px 30px rgba(16, 185, 129, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (selectedCandidate) {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 15px 40px rgba(16, 185, 129, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCandidate) {
                  e.target.style.transform = 'translateY(0)';
                  e.target.style.boxShadow = '0 10px 30px rgba(16, 185, 129, 0.3)';
                }
              }}
            >
              🎙️ Start Voice Interview
            </button>

            <button
              onClick={fetchCandidates}
              style={{
                background: 'transparent',
                color: '#6b7280',
                border: '2px solid #d1d5db',
                borderRadius: '12px',
                padding: '12px 20px',
                fontSize: '15px',
                cursor: 'pointer',
                width: '100%',
                marginTop: '15px',
                fontWeight: '600',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = '#667eea';
                e.target.style.color = '#667eea';
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = '#d1d5db';
                e.target.style.color = '#6b7280';
              }}
            >
              🔄 Refresh List
            </button>
          </>
        )}

        <div style={{
          marginTop: '50px',
          paddingTop: '25px',
          borderTop: '2px solid #f3f4f6',
          color: '#9ca3af',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          <p style={{ margin: 0 }}>AI Interviewer v6.0 - Enhanced Proctoring & Data Capture</p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
          transition: transform 0.2s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        input[type="range"]::-moz-range-thumb {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          cursor: pointer;
          border: none;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
      `}</style>
    </div>
  );
};

// =========================
// CONSENT COMPONENT (Same as before)
// =========================
const ConsentForm = () => {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [multiDisplayDetected, setMultiDisplayDetected] = useState(false);
  const [checkingDisplay, setCheckingDisplay] = useState(true);
  const [consents, setConsents] = useState({
    audio: false,
    video: false,
    camera: false,
    data: false,
    terms: false
  });

  useEffect(() => {
    if (candidateId) {
      fetchCandidate();
      checkDualDisplay();
    }
  }, [candidateId]);

  const fetchCandidate = async () => {
    try {
      const data = await apiService.getCandidate(candidateId);
      setCandidate(data);
    } catch (error) {
      console.error('Error fetching candidate:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkDualDisplay = async () => {
  try {
    setCheckingDisplay(true);
    
    // DISABLED: Multiple display detection
    console.log('Multiple display detection disabled');
    setMultiDisplayDetected(false);
    
  } catch (error) {
    console.warn('Display check error:', error);
    setMultiDisplayDetected(false);
  } finally {
    setCheckingDisplay(false);
  }
};

  const handleConsentChange = (type) => {
    setConsents(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const allConsentsGiven = Object.values(consents).every(consent => consent);

  const handleProceed = () => {
    if (multiDisplayDetected) {
      alert('Multiple displays detected. Please disconnect additional displays and use only a single monitor for the interview.');
      return;
    }

    if (allConsentsGiven) {
      localStorage.setItem(STORAGE_KEYS.CONSENT_GIVEN, JSON.stringify(consents));
      navigate(`/candidate/${candidateId}/interview`);
    }
  };

  if (loading || checkingDisplay) {
    return (
      <div style={{
        minHeight: '100vh',
        background: GRADIENTS.main,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '64px', marginBottom: '25px' }}>⏳</div>
          <h2 style={{ fontSize: '24px', fontWeight: '600' }}>
            {checkingDisplay ? 'Checking system configuration...' : 'Loading...'}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: GRADIENTS.main,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '45px',
        maxWidth: '650px',
        width: '100%',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
      }}>
        <h2 style={{
          textAlign: 'center',
          marginBottom: '35px',
          color: '#374151',
          fontSize: '28px',
          fontWeight: '700'
        }}>
          Interview Consent Form
        </h2>

        {multiDisplayDetected && (
          <div style={{
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '12px',
            padding: '25px',
            marginBottom: '25px',
            color: '#dc2626'
          }}>
            <h3 style={{
              margin: '0 0 15px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '18px'
            }}>
              <span style={{ fontSize: '28px' }}>⚠️</span>
              Multiple Displays Detected
            </h3>
            <p style={{ margin: '0 0 15px 0', fontSize: '15px', lineHeight: '1.6' }}>
              For interview security, please disconnect all additional monitors and use only a single display. 
              Refresh this page after disconnecting extra displays.
            </p>
            <button
              onClick={checkDualDisplay}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                cursor: 'pointer',
                fontSize: '15px',
                fontWeight: '600',
                transition: 'background 0.3s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = '#dc2626'}
              onMouseLeave={(e) => e.target.style.background = '#ef4444'}
            >
              🔄 Re-check Display Setup
            </button>
          </div>
        )}

        {candidate && (
          <div style={{
            background: '#f0f9ff',
            padding: '25px',
            borderRadius: '12px',
            marginBottom: '35px',
            border: '2px solid #dbeafe'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#1e40af', fontSize: '20px' }}>
              Welcome, {candidate.personal_information?.name || 'Candidate'}!
            </h3>
            <p style={{ margin: 0, color: '#3b82f6', fontSize: '15px' }}>
              Please review and accept all permissions below to proceed.
            </p>
          </div>
        )}

        <div style={{ marginBottom: '35px' }}>
          {[
            {
              key: 'audio',
              icon: '🎙️',
              title: 'Audio Recording',
              description: 'Allow microphone access to record your voice responses during the interview.'
            },
            {
              key: 'camera',
              icon: '📹',
              title: 'Camera Access',
              description: 'Allow camera access for continuous video monitoring throughout the interview.'
            },
            {
              key: 'video',
              icon: '🖥️',
              title: 'Screen Monitoring',
              description: 'Allow periodic screenshot capture for interview proctoring and security.'
            },
            {
              key: 'data',
              icon: '💾',
              title: 'Data Storage',
              description: 'Allow secure storage of interview data including responses, audio, and screenshots.'
            },
            {
              key: 'terms',
              icon: '📋',
              title: 'Terms & Conditions',
              description: 'I agree to the interview terms, conditions, and data handling policies.'
            }
          ].map(({ key, icon, title, description }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '18px',
                padding: '22px',
                border: '2px solid',
                borderColor: consents[key] ? '#10b981' : '#e5e7eb',
                borderRadius: '12px',
                marginBottom: '18px',
                cursor: 'pointer',
                background: consents[key] ? '#ecfdf5' : 'white',
                transition: 'all 0.3s ease',
                opacity: multiDisplayDetected ? 0.5 : 1,
                pointerEvents: multiDisplayDetected ? 'none' : 'auto'
              }}
              onMouseEnter={(e) => {
                if (!multiDisplayDetected) {
                  e.currentTarget.style.borderColor = consents[key] ? '#10b981' : '#667eea';
                  e.currentTarget.style.transform = 'translateX(5px)';
                }
              }}
              onMouseLeave={(e) => {
                if (!multiDisplayDetected) {
                  e.currentTarget.style.borderColor = consents[key] ? '#10b981' : '#e5e7eb';
                  e.currentTarget.style.transform = 'translateX(0)';
                }
              }}
            >
              <input
                type="checkbox"
                checked={consents[key]}
                onChange={() => handleConsentChange(key)}
                disabled={multiDisplayDetected}
                style={{
                  width: '22px',
                  height: '22px',
                  marginTop: '3px',
                  cursor: multiDisplayDetected ? 'not-allowed' : 'pointer'
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '24px' }}>{icon}</span>
                  <h4 style={{
                    margin: 0,
                    color: '#374151',
                    fontSize: '17px',
                    fontWeight: '600'
                  }}>
                    {title}
                  </h4>
                </div>
                <p style={{
                  margin: 0,
                  color: '#6b7280',
                  fontSize: '14px',
                  lineHeight: '1.6'
                }}>
                  {description}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div style={{
          display: 'flex',
          gap: '15px'
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'transparent',
              color: '#6b7280',
              border: '2px solid #d1d5db',
              borderRadius: '12px',
              padding: '14px 28px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: '600',
              flex: 1,
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.borderColor = '#9ca3af';
              e.target.style.color = '#374151';
            }}
            onMouseLeave={(e) => {
              e.target.style.borderColor = '#d1d5db';
              e.target.style.color = '#6b7280';
            }}
          >
            ← Back
          </button>

          <button
            onClick={handleProceed}
            disabled={!allConsentsGiven || multiDisplayDetected}
            style={{
              background: (allConsentsGiven && !multiDisplayDetected) ? GRADIENTS.success : '#9ca3af',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '14px 32px',
              fontWeight: '700',
              cursor: (allConsentsGiven && !multiDisplayDetected) ? 'pointer' : 'not-allowed',
              fontSize: '16px',
              flex: 2,
              transition: 'all 0.3s ease',
              opacity: (allConsentsGiven && !multiDisplayDetected) ? 1 : 0.6
            }}
            onMouseEnter={(e) => {
              if (allConsentsGiven && !multiDisplayDetected) {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            Proceed to Interview →
          </button>
        </div>
      </div>
    </div>
  );
};

// =========================
// INTERVIEW ROUTE WITH THRESHOLD
// =========================
const InterviewRoute = () => {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [cameraStream, setCameraStream] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [threshold, setThreshold] = useState(7);

  useEffect(() => {
    // Load threshold from localStorage
    const savedThreshold = localStorage.getItem('interview_threshold');
    if (savedThreshold) {
      setThreshold(parseInt(savedThreshold));
    }
    
    requestMediaPermissions();
  }, []);

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }, 
        audio: false 
      });
      setCameraStream(stream);
      setPermissionsGranted(true);
    } catch (error) {
      console.error('Media permission failed:', error);
      alert('Camera permission required. Please allow camera access.');
      navigate('/');
    }
  };

  const handleInterviewComplete = (result, capturedData) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    console.log('Interview completed:', result);
    navigate(`/candidate/${candidateId}/complete`);
  };

  const handleBackToSelection = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    navigate('/');
  };

  if (!permissionsGranted) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        flexDirection: 'column',
        gap: '25px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '5px solid rgba(255, 255, 255, 0.3)',
          borderTop: '5px solid white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <div style={{ color: 'white', fontSize: '18px', fontWeight: '600' }}>
          Requesting camera permissions...
        </div>
      </div>
    );
  }

  return (
    <Interview
      candidateId={candidateId}
      onComplete={handleInterviewComplete}
      onBack={handleBackToSelection}
      videoStream={cameraStream}
      threshold={threshold}
    />
  );
};

// =========================
// ENHANCED COMPLETION WITH EXPORT
// =========================
const InterviewComplete = () => {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const [exportData, setExportData] = useState(null);
  const [exportStatus, setExportStatus] = useState('');

  useEffect(() => {
    const data = localStorage.getItem('interview_data_' + candidateId);
    if (data) {
      setExportData(JSON.parse(data));
    }
  }, [candidateId]);

  const handleNewInterview = () => {
    localStorage.removeItem(STORAGE_KEYS.CANDIDATE_ID);
    localStorage.removeItem(STORAGE_KEYS.SESSION_ID);
    localStorage.removeItem(STORAGE_KEYS.CONSENT_GIVEN);
    localStorage.removeItem('interview_data_' + candidateId);
    navigate('/');
  };

  const downloadJSON = () => {
    if (!exportData) return;
    
    setExportStatus('Exporting JSON...');
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interview_${candidateId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus('JSON exported successfully!');
    setTimeout(() => setExportStatus(''), 3000);
  };

  const downloadScreenshots = () => {
    if (!exportData || !exportData.screenshots.length) return;
    
    setExportStatus(`Exporting ${exportData.screenshots.length} screenshots...`);
    exportData.screenshots.forEach((screenshot, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = screenshot.data;
        link.download = `screenshot_${candidateId}_q${screenshot.questionIndex + 1}_${index + 1}.jpg`;
        link.click();
      }, index * 100);
    });
    setTimeout(() => {
      setExportStatus('Screenshots exported successfully!');
      setTimeout(() => setExportStatus(''), 3000);
    }, exportData.screenshots.length * 100 + 500);
  };

  const downloadAudioRecordings = () => {
    if (!exportData || !exportData.audioRecordings.length) return;
    
    setExportStatus(`Exporting ${exportData.audioRecordings.length} audio recordings...`);
    exportData.audioRecordings.forEach((audio, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = audio.data;
        link.download = `audio_${candidateId}_q${audio.questionIndex + 1}_${index + 1}.webm`;
        link.click();
      }, index * 100);
    });
    setTimeout(() => {
      setExportStatus('Audio recordings exported successfully!');
      setTimeout(() => setExportStatus(''), 3000);
    }, exportData.audioRecordings.length * 100 + 500);
  };

  const downloadInteractionsCSV = () => {
    if (!exportData || !exportData.interactions.length) return;
    
    setExportStatus('Exporting interactions CSV...');
    const headers = ['Timestamp', 'Question Index', 'Question', 'Answer', 'Score', 'Threshold', 'Passed', 'Feedback', 'Is Follow-up'];
    const rows = exportData.interactions.map(int => [
      int.timestamp,
      int.questionIndex + 1,
      `"${int.question.replace(/"/g, '""')}"`,
      `"${int.answer.replace(/"/g, '""')}"`,
      int.score,
      int.threshold || 7,
      int.passedThreshold ? 'Yes' : 'No',
      `"${(int.feedback || []).join('; ').replace(/"/g, '""')}"`,
      int.isFollowUp ? 'Yes' : 'No'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `interactions_${candidateId}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus('CSV exported successfully!');
    setTimeout(() => setExportStatus(''), 3000);
  };

  const downloadTranscriptionsCSV = () => {
    if (!exportData || !exportData.transcriptions.length) return;
    
    setExportStatus('Exporting transcriptions CSV...');
    const headers = ['Timestamp', 'Question Index', 'Text', 'Is Final', 'Is Follow-up'];
    const rows = exportData.transcriptions.map(trans => [
      trans.timestamp,
      trans.questionIndex + 1,
      `"${trans.text.replace(/"/g, '""')}"`,
      trans.isFinal ? 'Yes' : 'No',
      trans.isFollowUp ? 'Yes' : 'No'
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcriptions_${candidateId}_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setExportStatus('Transcriptions exported successfully!');
    setTimeout(() => setExportStatus(''), 3000);
  };

  const downloadAllData = () => {
    downloadJSON();
    setTimeout(() => downloadInteractionsCSV(), 500);
    setTimeout(() => downloadTranscriptionsCSV(), 1000);
    setTimeout(() => downloadScreenshots(), 1500);
    setTimeout(() => downloadAudioRecordings(), 2000);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: GRADIENTS.success,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '50px',
        textAlign: 'center',
        maxWidth: '800px',
        width: '100%',
        boxShadow: '0 25px 50px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{ fontSize: '80px', marginBottom: '25px' }}>🎉</div>
        
        <h2 style={{
          color: '#374151',
          marginBottom: '20px',
          fontSize: '32px',
          fontWeight: '800'
        }}>
          Interview Completed Successfully!
        </h2>
        
        <p style={{
          color: '#6b7280',
          marginBottom: '35px',
          lineHeight: '1.8',
          fontSize: '16px'
        }}>
          Thank you for completing your AI interview. All responses, audio recordings, 
          and monitoring data have been captured and are ready for export.
        </p>

        <div style={{
          background: '#ecfdf5',
          border: '2px solid #10b981',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '35px'
        }}>
          <p style={{
            color: '#065f46',
            margin: 0,
            fontSize: '16px',
            fontWeight: '600'
          }}>
            Candidate ID: <span style={{ color: '#10b981' }}>{candidateId}</span>
          </p>
        </div>

        {exportStatus && (
          <div style={{
            background: '#dbeafe',
            border: '2px solid #3b82f6',
            borderRadius: '12px',
            padding: '15px',
            marginBottom: '25px',
            color: '#1e40af',
            fontSize: '15px',
            fontWeight: '600'
          }}>
            {exportStatus}
          </div>
        )}

        {exportData && (
          <div style={{
            background: '#f9fafb',
            borderRadius: '16px',
            padding: '30px',
            marginBottom: '30px',
            textAlign: 'left'
          }}>
            <h3 style={{
              margin: '0 0 25px 0',
              color: '#374151',
              fontSize: '22px',
              fontWeight: '700',
              textAlign: 'center'
            }}>
              Export Interview Data
            </h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '15px',
              marginBottom: '25px'
            }}>
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#667eea', marginBottom: '8px' }}>
                  {exportData.interactions.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Total Interactions</div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#10b981', marginBottom: '8px' }}>
                  {exportData.screenshots.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Screenshots</div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#f59e0b', marginBottom: '8px' }}>
                  {exportData.audioRecordings.length}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Audio Recordings</div>
              </div>
              
              <div style={{
                background: 'white',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e5e7eb'
              }}>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#8b5cf6', marginBottom: '8px' }}>
                  {exportData.transcriptions?.length || 0}
                </div>
                <div style={{ fontSize: '14px', color: '#6b7280' }}>Transcriptions</div>
              </div>
            </div>

            <div style={{
              background: 'white',
              padding: '20px',
              borderRadius: '12px',
              marginBottom: '25px',
              border: '2px solid #e5e7eb'
            }}>
              <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '10px' }}>
                <strong>Score Threshold:</strong> {exportData.threshold || 7}
              </div>
              <div style={{ fontSize: '14px', color: '#6b7280' }}>
                <strong>Passed Interactions:</strong> {exportData.metadata?.passedInteractions || 0} / {exportData.interactions.length}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '15px' }}>
              <button
                onClick={downloadJSON}
                style={{
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = '#2563eb';
                  e.target.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = '#3b82f6';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                📄 Complete Data (JSON)
              </button>
              
              <button
                onClick={downloadInteractionsCSV}
                disabled={!exportData.interactions.length}
                style={{
                  background: exportData.interactions.length ? '#10b981' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  cursor: exportData.interactions.length ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (exportData.interactions.length) {
                    e.target.style.background = '#059669';
                    e.target.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (exportData.interactions.length) {
                    e.target.style.background = '#10b981';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                📊 Interactions (CSV)
              </button>
              
              <button
                onClick={downloadTranscriptionsCSV}
                disabled={!exportData.transcriptions?.length}
                style={{
                  background: exportData.transcriptions?.length ? '#8b5cf6' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  cursor: exportData.transcriptions?.length ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (exportData.transcriptions?.length) {
                    e.target.style.background = '#7c3aed';
                    e.target.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (exportData.transcriptions?.length) {
                    e.target.style.background = '#8b5cf6';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                📝 Transcriptions (CSV)
              </button>
              
              <button
                onClick={downloadScreenshots}
                disabled={!exportData.screenshots.length}
                style={{
                  background: exportData.screenshots.length ? '#f59e0b' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  cursor: exportData.screenshots.length ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  if (exportData.screenshots.length) {
                    e.target.style.background = '#d97706';
                    e.target.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (exportData.screenshots.length) {
                    e.target.style.background = '#f59e0b';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                📸 Screenshots ({exportData.screenshots.length})
              </button>
              
              <button
                onClick={downloadAudioRecordings}
                disabled={!exportData.audioRecordings.length}
                style={{
                  background: exportData.audioRecordings.length ? '#ec4899' : '#9ca3af',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  padding: '14px 20px',
                  cursor: exportData.audioRecordings.length ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  fontWeight: '600',
                  transition: 'all 0.3s ease',
                  gridColumn: 'span 2'
                }}
                onMouseEnter={(e) => {
                  if (exportData.audioRecordings.length) {
                    e.target.style.background = '#db2777';
                    e.target.style.transform = 'translateY(-2px)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (exportData.audioRecordings.length) {
                    e.target.style.background = '#ec4899';
                    e.target.style.transform = 'translateY(0)';
                  }
                }}
              >
                🎙️ Audio Recordings ({exportData.audioRecordings.length})
              </button>
            </div>

            <button
              onClick={downloadAllData}
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                padding: '16px 24px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '700',
                width: '100%',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = 'none';
              }}
            >
              ⬇️ Download All Data
            </button>
          </div>
        )}

        <button
          onClick={handleNewInterview}
          style={{
            background: GRADIENTS.interview,
            color: 'white',
            border: 'none',
            borderRadius: '14px',
            padding: '16px 32px',
            cursor: 'pointer',
            fontWeight: '700',
            width: '100%',
            fontSize: '17px',
            transition: 'all 0.3s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 15px 40px rgba(102, 126, 234, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = 'none';
          }}
        >
          🔄 Start New Interview
        </button>
      </div>
    </div>
  );
};

// =========================
// MAIN APP COMPONENT
// =========================
const App = () => {
  useEffect(() => {
    audioService.initialize().then(result => {
      if (result.success) {
        console.log('Audio service initialized successfully');
      } else {
        console.warn('Audio service initialization failed:', result.error);
      }
    });

    return () => {
      audioService.cleanup();
    };
  }, []);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<CandidateSelection />} />
          <Route path="/candidate/:candidateId/consent" element={<ConsentForm />} />
          <Route path="/candidate/:candidateId/interview" element={<InterviewRoute />} />
          <Route path="/candidate/:candidateId/complete" element={<InterviewComplete />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Production.css';

function ProductionDevice() {
  const navigate = useNavigate();
  const [showStartModal, setShowStartModal] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [showBufferModal, setShowBufferModal] = useState(false);
  const [manufacturingStarted, setManufacturingStarted] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [leaderName, setLeaderName] = useState('');
  const [shiftNumber, setShiftNumber] = useState('');
  const [formData, setFormData] = useState({
    pic: '',
    moNumber: '',
    skuName: '',
    authenticityRows: [{ firstAuthenticity: '', lastAuthenticity: '', rollNumber: '' }]
  });
  const [bufferData, setBufferData] = useState({
    pic: '',
    moNumber: '',
    skuName: '',
    authenticityNumbers: ['']
  });
  const [savedData, setSavedData] = useState([]);
  const [bufferDataMap, setBufferDataMap] = useState({});

  useEffect(() => {
    fetchData();
    // Load session from localStorage
    const savedSession = localStorage.getItem('production_device_session');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        setSessionId(session.sessionId);
        setLeaderName(session.leaderName);
        setShiftNumber(session.shiftNumber);
        setManufacturingStarted(session.manufacturingStarted);
      } catch (error) {
        console.error('Error loading session:', error);
      }
    }
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get('/api/production/device');
      setSavedData(response.data);
      
      // Fetch buffer data for all MO Numbers
      const moNumbers = new Set();
      response.data.forEach(session => {
        session.inputs.forEach(input => {
          moNumbers.add(input.mo_number);
        });
      });
      
      const bufferPromises = Array.from(moNumbers).map(async (moNumber) => {
        try {
          const bufferResponse = await axios.get(`/api/buffer/device`, {
            params: { moNumber }
          });
          return { moNumber, buffers: bufferResponse.data };
        } catch (error) {
          console.error(`Error fetching buffer for ${moNumber}:`, error);
          return { moNumber, buffers: [] };
        }
      });
      
      const bufferResults = await Promise.all(bufferPromises);
      const bufferMap = {};
      bufferResults.forEach(({ moNumber, buffers }) => {
        if (buffers.length > 0) {
          bufferMap[moNumber] = buffers;
        }
      });
      setBufferDataMap(bufferMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleStartManufacturing = () => {
    setShowStartModal(true);
  };

  const handleConfirmStart = () => {
    if (leaderName && shiftNumber) {
      // Generate unique session ID
      const newSessionId = `${leaderName}_${shiftNumber}_${Date.now()}`;
      setSessionId(newSessionId);
      setManufacturingStarted(true);
      setShowStartModal(false);
      
      // Save session to localStorage
      const sessionData = {
        sessionId: newSessionId,
        leaderName: leaderName,
        shiftNumber: shiftNumber,
        manufacturingStarted: true
      };
      localStorage.setItem('production_device_session', JSON.stringify(sessionData));
    }
  };

  const handleInputAuthenticity = () => {
    setShowInputModal(true);
  };

  const handleInputBuffer = () => {
    setShowBufferModal(true);
  };

  const handleAddBufferNumber = () => {
    setBufferData({
      ...bufferData,
      authenticityNumbers: [...bufferData.authenticityNumbers, '']
    });
  };

  const handleDeleteBufferNumber = (index) => {
    if (bufferData.authenticityNumbers.length > 1) {
      const newNumbers = bufferData.authenticityNumbers.filter((_, i) => i !== index);
      setBufferData({
        ...bufferData,
        authenticityNumbers: newNumbers
      });
    }
  };

  const handleBufferNumberChange = (index, value) => {
    const newNumbers = [...bufferData.authenticityNumbers];
    newNumbers[index] = value;
    setBufferData({
      ...bufferData,
      authenticityNumbers: newNumbers
    });
  };

  const handleConfirmBuffer = async () => {
    if (!bufferData.pic || !bufferData.moNumber || !bufferData.skuName) {
      alert('Please fill in all required fields');
      return;
    }

    const validNumbers = bufferData.authenticityNumbers.filter(num => num.trim() !== '');
    if (validNumbers.length === 0) {
      alert('Please enter at least one authenticity number');
      return;
    }

    try {
      await axios.post('/api/buffer/device', {
        session_id: sessionId,
        pic: bufferData.pic,
        mo_number: bufferData.moNumber,
        sku_name: bufferData.skuName,
        authenticity_numbers: validNumbers
      });

      // Reset form
      setBufferData({
        pic: '',
        moNumber: '',
        skuName: '',
        authenticityNumbers: ['']
      });
      setShowBufferModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving buffer data:', error);
      alert('Error saving buffer data');
    }
  };

  const handleAddRow = () => {
    setFormData({
      ...formData,
      authenticityRows: [
        ...formData.authenticityRows,
        { firstAuthenticity: '', lastAuthenticity: '', rollNumber: '' }
      ]
    });
  };

  const handleDeleteRow = (index) => {
    if (formData.authenticityRows.length > 1) {
      const newRows = formData.authenticityRows.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        authenticityRows: newRows
      });
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...formData.authenticityRows];
    newRows[index][field] = value;
    setFormData({
      ...formData,
      authenticityRows: newRows
    });
  };

  const handleEndManufacturing = async () => {
    if (window.confirm('Are you sure you want to end the manufacturing process?')) {
      try {
        await axios.put('/api/production/device/end-session', {
          session_id: sessionId
        });
        setManufacturingStarted(false);
        setSessionId(null);
        setLeaderName('');
        setShiftNumber('');
        setFormData({
          pic: '',
          moNumber: '',
          skuName: '',
          authenticityRows: [{ firstAuthenticity: '', lastAuthenticity: '', rollNumber: '' }]
        });
        
        // Remove session from localStorage
        localStorage.removeItem('production_device_session');
        
        fetchData();
      } catch (error) {
        console.error('Error ending session:', error);
        alert('Error ending session');
      }
    }
  };

  const handleConfirmInput = async () => {
    if (!formData.pic || !formData.moNumber || !formData.skuName) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      await axios.post('/api/production/device', {
        session_id: sessionId,
        leader_name: leaderName,
        shift_number: shiftNumber,
        pic: formData.pic,
        mo_number: formData.moNumber,
        sku_name: formData.skuName,
        authenticity_data: formData.authenticityRows
      });

      // Reset form
      setFormData({
        pic: '',
        moNumber: '',
        skuName: '',
        authenticityRows: [{ firstAuthenticity: '', lastAuthenticity: '', rollNumber: '' }]
      });
      setShowInputModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error saving data');
    }
  };

  return (
    <div className="production-container">
      <div className="production-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>Production Device</h1>
      </div>

      <div className="production-content">
        {!manufacturingStarted ? (
          <button onClick={handleStartManufacturing} className="start-button">
            Start Manufacturing Process
          </button>
        ) : (
          <div>
            <div className="button-group">
              <button onClick={handleInputAuthenticity} className="input-button">
                Input Authenticity Label Process
              </button>
              <button onClick={handleInputBuffer} className="buffer-button">
                Input Buffer Authenticity
              </button>
              <button onClick={handleEndManufacturing} className="end-button">
                End Manufacturing Process
              </button>
            </div>
            <div className="info-display">
              <p><strong>Leader:</strong> {leaderName}</p>
              <p><strong>Shift Number:</strong> {shiftNumber}</p>
            </div>
          </div>
        )}

        <div className="data-list">
          <h2>Saved Data</h2>
          {savedData.length === 0 ? (
            <p className="no-data">No data available</p>
          ) : (
            <div className="data-items">
              {savedData.map((session) => (
                <div key={session.session_id} className={`data-item ${session.status === 'completed' ? 'completed' : 'active'}`}>
                  <div className="data-header">
                    <div>
                      <h3>Session: {session.leader_name} - Shift {session.shift_number}</h3>
                      <span className={`status-badge ${session.status}`}>
                        {session.status === 'completed' ? 'Completed' : 'Active'}
                      </span>
                    </div>
                    <span className="date">{new Date(session.created_at).toLocaleString()}</span>
                  </div>
                  <div className="data-details">
                    <div className="data-details-info-row">
                      <p><strong>Leader:</strong> {session.leader_name}</p>
                      <p><strong>Shift:</strong> {session.shift_number}</p>
                      <p><strong>Total Inputs:</strong> {session.inputs.length}</p>
                    </div>
                    
                    <div className="inputs-container">
                      {session.inputs.map((input, idx) => (
                        <div key={input.id} className="input-card">
                          <div className="input-card-header">
                            <span className="input-number">Input #{idx + 1}</span>
                            <span className="input-date">{new Date(input.created_at).toLocaleString()}</span>
                          </div>
                          <div className="input-card-body">
                            <div className="input-card-info-row">
                              <p><strong>PIC:</strong> {input.pic}</p>
                              <p><strong>MO Number:</strong> {input.mo_number}</p>
                              <p><strong>SKU Name:</strong> {input.sku_name}</p>
                            </div>
                            <div className="authenticity-list">
                              <strong>Authenticity Data:</strong>
                              {input.authenticity_data.map((row, rowIdx) => (
                                <div key={rowIdx} className="authenticity-row">
                                  <span>First: {row.firstAuthenticity}</span>
                                  <span>Last: {row.lastAuthenticity}</span>
                                  <span>Roll: {row.rollNumber}</span>
                                </div>
                              ))}
                            </div>
                            {bufferDataMap[input.mo_number] && bufferDataMap[input.mo_number].length > 0 && (
                              <div className="buffer-card">
                                <div className="buffer-card-header">
                                  <strong>Buffer Authenticity</strong>
                                </div>
                                <div className="buffer-card-body">
                                  {bufferDataMap[input.mo_number].map((buffer, bufferIdx) => (
                                    <div key={buffer.id} className="buffer-item">
                                      <div className="buffer-info">
                                        <span><strong>PIC:</strong> {buffer.pic}</span>
                                        <span><strong>SKU:</strong> {buffer.sku_name}</span>
                                      </div>
                                      <div className="buffer-numbers">
                                        {buffer.authenticity_numbers.map((num, numIdx) => (
                                          <span key={numIdx} className="buffer-number">{num}</span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Start Manufacturing Modal */}
      {showStartModal && (
        <div className="modal-overlay" onClick={() => setShowStartModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Start Manufacturing Process</h2>
            <div className="form-group">
              <label>Leader Name</label>
              <select
                value={leaderName}
                onChange={(e) => setLeaderName(e.target.value)}
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              >
                <option value="">Select leader name</option>
                <option value="Hikmatul Iman">Hikmatul Iman</option>
                <option value="Calvin Lama Tokan">Calvin Lama Tokan</option>
              </select>
            </div>
            <div className="form-group">
              <label>Shift Number</label>
              <input
                type="text"
                value={shiftNumber}
                onChange={(e) => setShiftNumber(e.target.value)}
                placeholder="Enter shift number"
              />
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowStartModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleConfirmStart} className="confirm-button">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Authenticity Modal */}
      {showInputModal && (
        <div className="modal-overlay" onClick={() => setShowInputModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Input Authenticity Label Process</h2>
            <div className="form-group">
              <label>PIC *</label>
              <input
                type="text"
                value={formData.pic}
                onChange={(e) => setFormData({ ...formData, pic: e.target.value })}
                placeholder="Enter PIC"
              />
            </div>
            <div className="form-group">
              <label>MO Number *</label>
              <input
                type="text"
                value={formData.moNumber}
                onChange={(e) => setFormData({ ...formData, moNumber: e.target.value })}
                placeholder="Enter MO Number"
              />
            </div>
            <div className="form-group">
              <label>SKU Name *</label>
              <input
                type="text"
                value={formData.skuName}
                onChange={(e) => setFormData({ ...formData, skuName: e.target.value })}
                placeholder="Enter SKU Name"
              />
            </div>
            <div className="authenticity-section">
              <label>Authenticity Data</label>
              {formData.authenticityRows.map((row, index) => (
                <div key={index} className="authenticity-row-input">
                  <input
                    type="text"
                    placeholder="First Authenticity at"
                    value={row.firstAuthenticity}
                    onChange={(e) => handleRowChange(index, 'firstAuthenticity', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Last Authenticity at"
                    value={row.lastAuthenticity}
                    onChange={(e) => handleRowChange(index, 'lastAuthenticity', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Roll Number"
                    value={row.rollNumber}
                    onChange={(e) => handleRowChange(index, 'rollNumber', e.target.value)}
                  />
                  {formData.authenticityRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(index)}
                      className="delete-row-button"
                      title="Delete row"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button onClick={handleAddRow} className="add-row-button">
                + Add Row
              </button>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowInputModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleConfirmInput} className="confirm-button">
                Confirm Input
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input Buffer Authenticity Modal */}
      {showBufferModal && (
        <div className="modal-overlay" onClick={() => setShowBufferModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Input Buffer Authenticity</h2>
            <div className="form-group">
              <label>Nama PIC *</label>
              <input
                type="text"
                value={bufferData.pic}
                onChange={(e) => setBufferData({ ...bufferData, pic: e.target.value })}
                placeholder="Enter PIC name"
              />
            </div>
            <div className="form-group">
              <label>MO Number *</label>
              <input
                type="text"
                value={bufferData.moNumber}
                onChange={(e) => setBufferData({ ...bufferData, moNumber: e.target.value })}
                placeholder="Enter MO Number"
              />
            </div>
            <div className="form-group">
              <label>SKU Name *</label>
              <input
                type="text"
                value={bufferData.skuName}
                onChange={(e) => setBufferData({ ...bufferData, skuName: e.target.value })}
                placeholder="Enter SKU Name"
              />
            </div>
            <div className="authenticity-section">
              <label>Nomor Authenticity</label>
              {bufferData.authenticityNumbers.map((number, index) => (
                <div key={index} className="buffer-row-input">
                  <input
                    type="text"
                    placeholder="Enter authenticity number"
                    value={number}
                    onChange={(e) => handleBufferNumberChange(index, e.target.value)}
                  />
                  {bufferData.authenticityNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteBufferNumber(index)}
                      className="delete-row-button"
                      title="Delete number"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button onClick={handleAddBufferNumber} className="add-row-button">
                + Add Number
              </button>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowBufferModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleConfirmBuffer} className="confirm-button">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionDevice;


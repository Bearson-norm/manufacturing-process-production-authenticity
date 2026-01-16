import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Production.css';

// Helper function untuk format tanggal dengan zona waktu Indonesia (WIB)
const formatDateIndonesia = (dateString) => {
  if (!dateString) return '';
  
  try {
    let date;
    
    // Jika dateString sudah dalam format ISO dengan timezone, gunakan langsung
    if (dateString.includes('T') && (dateString.includes('Z') || dateString.includes('+') || dateString.includes('-'))) {
      date = new Date(dateString);
    } else {
      // Jika format SQLite (YYYY-MM-DD HH:MM:SS) tanpa timezone
      // SQLite CURRENT_TIMESTAMP biasanya menyimpan dalam UTC
      // Konversi ke format ISO dengan timezone UTC
      const sqliteDate = dateString.replace(' ', 'T');
      // Tambahkan 'Z' untuk menandakan UTC, atau tambahkan +00:00
      if (!sqliteDate.includes('Z') && !sqliteDate.includes('+') && !sqliteDate.includes('-', 10)) {
        date = new Date(sqliteDate + 'Z'); // Asumsikan UTC
      } else {
        date = new Date(sqliteDate);
      }
    }
    
    // Validasi apakah date valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Konversi ke zona waktu Asia/Jakarta (WIB, UTC+7)
    // Gunakan Intl.DateTimeFormat untuk konversi yang lebih akurat
    const formatter = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(date);
    const day = parts.find(p => p.type === 'day').value;
    const month = parts.find(p => p.type === 'month').value;
    const year = parts.find(p => p.type === 'year').value;
    const hour = parts.find(p => p.type === 'hour').value;
    const minute = parts.find(p => p.type === 'minute').value;
    const second = parts.find(p => p.type === 'second').value;
    
    // Format: DD/MM/YYYY, HH.MM.SS
    return `${day}/${month}/${year}, ${hour}.${minute}.${second}`;
  } catch (error) {
    console.error('Error formatting date:', error, dateString);
    return '';
  }
};

function ProductionLiquid() {
  const navigate = useNavigate();
  const [showStartModal, setShowStartModal] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [showBufferModal, setShowBufferModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
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
  const [rejectData, setRejectData] = useState({
    pic: '',
    moNumber: '',
    skuName: '',
    authenticityNumbers: ['']
  });
  const [savedData, setSavedData] = useState([]);
  const [bufferDataMap, setBufferDataMap] = useState({});
  const [rejectDataMap, setRejectDataMap] = useState({});
  const [moList, setMoList] = useState([]);
  const [selectedMo, setSelectedMo] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [editingInput, setEditingInput] = useState(null);
  const [editFormData, setEditFormData] = useState(null);
  const [moSearchTerm, setMoSearchTerm] = useState('');
  const [bufferMoSearchTerm, setBufferMoSearchTerm] = useState('');
  const [rejectMoSearchTerm, setRejectMoSearchTerm] = useState('');
  const [selectedBufferMo, setSelectedBufferMo] = useState(null);
  const [selectedRejectMo, setSelectedRejectMo] = useState(null);
  const [picList, setPicList] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [picSearchTerm, setPicSearchTerm] = useState('');
  const [editingMoNumber, setEditingMoNumber] = useState(null);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingBuffer, setEditingBuffer] = useState(null);
  const [editingReject, setEditingReject] = useState(null);
  const [editBufferData, setEditBufferData] = useState(null);
  const [editRejectData, setEditRejectData] = useState(null);

  useEffect(() => {
    fetchData();
    fetchPicList();
    // Load session from localStorage
    const savedSession = localStorage.getItem('production_liquid_session');
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
      const response = await axios.get('/api/production/liquid');
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
          const bufferResponse = await axios.get(`/api/buffer/liquid`, {
            params: { moNumber }
          });
          return { moNumber, buffers: bufferResponse.data };
        } catch (error) {
          console.error(`Error fetching buffer for ${moNumber}:`, error);
          return { moNumber, buffers: [] };
        }
      });
      
      const rejectPromises = Array.from(moNumbers).map(async (moNumber) => {
        try {
          const rejectResponse = await axios.get(`/api/reject/liquid`, {
            params: { moNumber }
          });
          return { moNumber, rejects: rejectResponse.data };
        } catch (error) {
          console.error(`Error fetching reject for ${moNumber}:`, error);
          return { moNumber, rejects: [] };
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
      
      const rejectResults = await Promise.all(rejectPromises);
      const rejectMap = {};
      rejectResults.forEach(({ moNumber, rejects }) => {
        if (rejects.length > 0) {
          rejectMap[moNumber] = rejects;
        }
      });
      setRejectDataMap(rejectMap);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const fetchPicList = async () => {
    try {
      const response = await axios.get('/api/pic/list');
      if (response.data.success) {
        setPicList(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching PIC list:', error);
    }
  };

  const handleStartManufacturing = () => {
    setShowStartModal(true);
  };

  const handleConfirmStart = () => {
    if (leaderName && shiftNumber) {
      // Check if there's an active session (either in state or in savedData)
      if (manufacturingStarted && sessionId) {
        alert(`Ada session yang sedang aktif. Silakan akhiri session saat ini sebelum memulai session baru.`);
        setShowStartModal(false);
        return;
      }

      const activeSession = savedData.find(session => session.status !== 'completed');
      if (activeSession) {
        alert(`Ada session yang sedang aktif: ${activeSession.leader_name} - Shift ${activeSession.shift_number}. Silakan akhiri session saat ini sebelum memulai session baru.`);
        setShowStartModal(false);
        return;
      }

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
      localStorage.setItem('production_liquid_session', JSON.stringify(sessionData));
    }
  };

  const handleInputAuthenticity = async () => {
    setShowInputModal(true);
    setMoSearchTerm('');
    // Fetch MO list from cache (filtered by production type) when modal opens
    try {
      const response = await axios.get('/api/odoo/mo-list', {
        params: { productionType: 'liquid' }
      });
      if (response.data.success) {
        const moData = response.data.data || [];
        
        // Get all MO numbers that have already been input
        const usedMoNumbers = new Set();
        savedData.forEach(session => {
          session.inputs.forEach(input => {
            usedMoNumbers.add(input.mo_number);
          });
        });
        
        // Filter out SKU names that start with "MIXING" and MO numbers that have already been used
        const filteredMoData = moData.filter(mo => {
          // Exclude MIXING SKU
          if (mo.sku_name && mo.sku_name.toUpperCase().startsWith('MIXING')) {
            return false;
          }
          // Exclude MO numbers that have already been input
          if (usedMoNumbers.has(mo.mo_number)) {
            return false;
          }
          return true;
        });
        
        setMoList(filteredMoData);
        console.log(`✅ Loaded ${filteredMoData.length} MO records for Liquid production (filtered from ${moData.length}, ${usedMoNumbers.size} already used)`);
        if (filteredMoData.length === 0) {
          alert('Tidak ada data MO untuk produksi Liquid dalam 7 hari terakhir. Silakan periksa apakah scheduler telah memperbarui cache.');
        }
      } else {
        console.error('Failed to fetch MO list:', response.data.error);
        setMoList([]);
      }
    } catch (error) {
      console.error('Error fetching MO list:', error);
      setMoList([]);
      alert('Error mengambil daftar MO. Silakan coba lagi atau periksa koneksi server.');
    }
  };

  const handleInputBuffer = async () => {
    setShowBufferModal(true);
    setBufferMoSearchTerm('');
    setSelectedBufferMo(null);
    // Fetch MO list from cache (filtered by production type) when modal opens
    try {
      const response = await axios.get('/api/odoo/mo-list', {
        params: { productionType: 'liquid' }
      });
      if (response.data.success) {
        const moData = response.data.data || [];
        // Filter out SKU names that start with "MIXING"
        const filteredMoData = moData.filter(mo => {
          return !(mo.sku_name && mo.sku_name.toUpperCase().startsWith('MIXING'));
        });
        setMoList(filteredMoData);
      }
    } catch (error) {
      console.error('Error fetching MO list:', error);
      alert('Error loading MO list. Please try again.');
    }
  };

  const handleInputReject = async () => {
    setShowRejectModal(true);
    setRejectMoSearchTerm('');
    setSelectedRejectMo(null);
    // Fetch MO list from cache (filtered by production type) when modal opens
    try {
      const response = await axios.get('/api/odoo/mo-list', {
        params: { productionType: 'liquid' }
      });
      if (response.data.success) {
        const moData = response.data.data || [];
        // Filter out SKU names that start with "MIXING"
        const filteredMoData = moData.filter(mo => {
          return !(mo.sku_name && mo.sku_name.toUpperCase().startsWith('MIXING'));
        });
        setMoList(filteredMoData);
      }
    } catch (error) {
      console.error('Error fetching MO list:', error);
      alert('Error loading MO list. Please try again.');
    }
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
      alert('Silakan isi semua field yang wajib diisi');
      return;
    }

    const validNumbers = bufferData.authenticityNumbers.filter(num => num.trim() !== '');
    if (validNumbers.length === 0) {
      alert('Silakan masukkan setidaknya satu nomor authenticity');
      return;
    }

    try {
      await axios.post('/api/buffer/liquid', {
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
      alert('Error menyimpan data buffer');
    }
  };

  const handleAddRejectNumber = () => {
    setRejectData({
      ...rejectData,
      authenticityNumbers: [...rejectData.authenticityNumbers, '']
    });
  };

  const handleDeleteRejectNumber = (index) => {
    if (rejectData.authenticityNumbers.length > 1) {
      const newNumbers = rejectData.authenticityNumbers.filter((_, i) => i !== index);
      setRejectData({
        ...rejectData,
        authenticityNumbers: newNumbers
      });
    }
  };

  const handleRejectNumberChange = (index, value) => {
    const newNumbers = [...rejectData.authenticityNumbers];
    newNumbers[index] = value;
    setRejectData({
      ...rejectData,
      authenticityNumbers: newNumbers
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectData.pic || !rejectData.moNumber || !rejectData.skuName) {
      alert('Silakan isi semua field yang wajib diisi');
      return;
    }

    const validNumbers = rejectData.authenticityNumbers.filter(num => num.trim() !== '');
    if (validNumbers.length === 0) {
      alert('Silakan masukkan setidaknya satu nomor authenticity');
      return;
    }

    try {
      await axios.post('/api/reject/liquid', {
        session_id: sessionId,
        pic: rejectData.pic,
        mo_number: rejectData.moNumber,
        sku_name: rejectData.skuName,
        authenticity_numbers: validNumbers
      });

      // Reset form
      setRejectData({
        pic: '',
        moNumber: '',
        skuName: '',
        authenticityNumbers: ['']
      });
      setShowRejectModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving reject data:', error);
      alert('Error menyimpan data reject');
    }
  };

  const handleUpdateBuffer = async () => {
    if (!editBufferData.pic || !editBufferData.moNumber || !editBufferData.skuName) {
      alert('Silakan isi semua field yang wajib diisi');
      return;
    }

    const validNumbers = editBufferData.authenticityNumbers.filter(num => num.trim() !== '');
    if (validNumbers.length === 0) {
      alert('Silakan masukkan setidaknya satu nomor authenticity');
      return;
    }

    try {
      await axios.put(`/api/buffer/liquid/${editingBuffer.id}`, {
        pic: editBufferData.pic,
        mo_number: editBufferData.moNumber,
        sku_name: editBufferData.skuName,
        authenticity_numbers: validNumbers
      });

      setEditingBuffer(null);
      setEditBufferData(null);
      fetchData();
      alert('Buffer data berhasil diperbarui');
    } catch (error) {
      console.error('Error updating buffer data:', error);
      alert('Error memperbarui data buffer');
    }
  };

  const handleUpdateReject = async () => {
    if (!editRejectData.pic || !editRejectData.moNumber || !editRejectData.skuName) {
      alert('Silakan isi semua field yang wajib diisi');
      return;
    }

    const validNumbers = editRejectData.authenticityNumbers.filter(num => num.trim() !== '');
    if (validNumbers.length === 0) {
      alert('Silakan masukkan setidaknya satu nomor authenticity');
      return;
    }

    try {
      await axios.put(`/api/reject/liquid/${editingReject.id}`, {
        pic: editRejectData.pic,
        mo_number: editRejectData.moNumber,
        sku_name: editRejectData.skuName,
        authenticity_numbers: validNumbers
      });

      setEditingReject(null);
      setEditRejectData(null);
      fetchData();
      alert('Reject data berhasil diperbarui');
    } catch (error) {
      console.error('Error updating reject data:', error);
      alert('Error memperbarui data reject');
    }
  };

  const handleAddEditBufferNumber = () => {
    setEditBufferData({
      ...editBufferData,
      authenticityNumbers: [...editBufferData.authenticityNumbers, '']
    });
  };

  const handleRemoveEditBufferNumber = (index) => {
    if (editBufferData.authenticityNumbers.length > 1) {
      const newNumbers = editBufferData.authenticityNumbers.filter((_, i) => i !== index);
      setEditBufferData({
        ...editBufferData,
        authenticityNumbers: newNumbers
      });
    }
  };

  const handleEditBufferNumberChange = (index, value) => {
    const newNumbers = [...editBufferData.authenticityNumbers];
    newNumbers[index] = value;
    setEditBufferData({
      ...editBufferData,
      authenticityNumbers: newNumbers
    });
  };

  const handleAddEditRejectNumber = () => {
    setEditRejectData({
      ...editRejectData,
      authenticityNumbers: [...editRejectData.authenticityNumbers, '']
    });
  };

  const handleRemoveEditRejectNumber = (index) => {
    if (editRejectData.authenticityNumbers.length > 1) {
      const newNumbers = editRejectData.authenticityNumbers.filter((_, i) => i !== index);
      setEditRejectData({
        ...editRejectData,
        authenticityNumbers: newNumbers
      });
    }
  };

  const handleEditRejectNumberChange = (index, value) => {
    const newNumbers = [...editRejectData.authenticityNumbers];
    newNumbers[index] = value;
    setEditRejectData({
      ...editRejectData,
      authenticityNumbers: newNumbers
    });
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

  // Handle Enter key press for scanner input (auto-advance to next field)
  const handleScannerKeyDown = (e, rowIndex, currentField) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      
      // Find the next input field
      const inputs = document.querySelectorAll('.authenticity-row-input input[type="text"]');
      const currentIndex = Array.from(inputs).findIndex(input => input === e.target);
      
      if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
        // Move to next input
        inputs[currentIndex + 1].focus();
      } else if (currentIndex === inputs.length - 1) {
        // Last field in last row - add new row and focus on first field of new row
        handleAddRow();
        // Delay to allow new row to be rendered
        setTimeout(() => {
          const newInputs = document.querySelectorAll('.authenticity-row-input input[type="text"]');
          if (newInputs.length > inputs.length) {
            newInputs[inputs.length].focus();
          }
        }, 50);
      }
    }
  };

  // Handle Enter key for buffer authenticity numbers (scanner support)
  const handleBufferScannerKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      
      // If this is the last input, add a new one
      if (index === bufferData.authenticityNumbers.length - 1) {
        handleAddBufferNumber();
        // Focus on the new input after it's rendered
        setTimeout(() => {
          const inputs = document.querySelectorAll('.buffer-row-input input[type="text"]');
          if (inputs[index + 1]) {
            inputs[index + 1].focus();
          }
        }, 50);
      } else {
        // Move to next input
        const inputs = document.querySelectorAll('.buffer-row-input input[type="text"]');
        if (inputs[index + 1]) {
          inputs[index + 1].focus();
        }
      }
    }
  };

  // Handle Enter key for reject authenticity numbers (scanner support)
  const handleRejectScannerKeyDown = (e, index) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      e.preventDefault();
      
      // If this is the last input, add a new one
      if (index === rejectData.authenticityNumbers.length - 1) {
        handleAddRejectNumber();
        // Focus on the new input after it's rendered
        setTimeout(() => {
          const inputs = document.querySelectorAll('.buffer-row-input input[type="text"]');
          const rejectInputs = Array.from(inputs).filter(input => 
            input.placeholder === 'Enter authenticity number' && 
            input.value === rejectData.authenticityNumbers[rejectData.authenticityNumbers.length - 1]
          );
          if (rejectInputs[0]) {
            const allRejectInputs = document.querySelectorAll('.buffer-row-input input[type="text"]');
            const lastRejectIndex = Array.from(allRejectInputs).findIndex(inp => inp === e.target);
            if (allRejectInputs[lastRejectIndex + 1]) {
              allRejectInputs[lastRejectIndex + 1].focus();
            }
          }
        }, 50);
      } else {
        // Move to next input
        const inputs = document.querySelectorAll('.buffer-row-input input[type="text"]');
        const currentIndex = Array.from(inputs).findIndex(input => input === e.target);
        if (currentIndex !== -1 && inputs[currentIndex + 1]) {
          inputs[currentIndex + 1].focus();
        }
      }
    }
  };

  const handleEndManufacturing = async () => {
    if (window.confirm('Apakah Anda yakin ingin mengakhiri proses manufacturing?')) {
      try {
        await axios.put('/api/production/liquid/end-session', {
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
        localStorage.removeItem('production_liquid_session');
        
        fetchData();
      } catch (error) {
        console.error('Error ending session:', error);
        alert('Error mengakhiri session');
      }
    }
  };

  const handleMoChange = (moNumber) => {
    const mo = moList.find(m => m.mo_number === moNumber);
    setSelectedMo(mo);
    setMoSearchTerm(mo ? `${mo.mo_number} - ${mo.sku_name}` : '');
    setFormData({
      ...formData,
      moNumber: moNumber,
      skuName: mo ? mo.sku_name : ''
    });
  };

  const handleBufferMoChange = (moNumber) => {
    const mo = moList.find(m => m.mo_number === moNumber);
    setSelectedBufferMo(mo);
    setBufferMoSearchTerm(mo ? `${mo.mo_number} - ${mo.sku_name}` : '');
    setBufferData({
      ...bufferData,
      moNumber: moNumber,
      skuName: mo ? mo.sku_name : ''
    });
  };

  const handleRejectMoChange = (moNumber) => {
    const mo = moList.find(m => m.mo_number === moNumber);
    setSelectedRejectMo(mo);
    setRejectMoSearchTerm(mo ? `${mo.mo_number} - ${mo.sku_name}` : '');
    setRejectData({
      ...rejectData,
      moNumber: moNumber,
      skuName: mo ? mo.sku_name : ''
    });
  };

  const handleConfirmInput = async () => {
    if (!formData.pic || !formData.moNumber || !formData.skuName) {
      alert('Silakan isi semua field yang wajib diisi');
      return;
    }

    // Check if there's an active MO number in the current session
    const currentSession = savedData.find(s => s.session_id === sessionId);
    if (currentSession) {
      // Group inputs by MO Number
      const groupedByMo = {};
      currentSession.inputs.forEach(input => {
        if (!groupedByMo[input.mo_number]) {
          groupedByMo[input.mo_number] = [];
        }
        groupedByMo[input.mo_number].push(input);
      });

      // Check if there's any MO group with active inputs (not the one being input)
      const activeMoGroups = Object.entries(groupedByMo).filter(([moNumber, inputs]) => {
        if (moNumber === formData.moNumber) {
          return false; // Skip the MO number being input
        }
        return inputs.some(input => input.status === 'active');
      });

      if (activeMoGroups.length > 0) {
        const activeMoNumbers = activeMoGroups.map(([moNumber]) => moNumber).join(', ');
        alert(`Ada MO number yang sedang aktif: ${activeMoNumbers}. Silakan submit MO yang aktif terlebih dahulu sebelum menginput MO baru.`);
        setShowInputModal(false);
        return;
      }
    }

    try {
      await axios.post('/api/production/liquid', {
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
      setSelectedMo(null);
      setMoSearchTerm('');
      setShowInputModal(false);
      fetchData();
    } catch (error) {
      console.error('Error saving data:', error);
      alert('Error menyimpan data');
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleSubmitStatus = async (inputId) => {
    try {
      await axios.put(`/api/production/liquid/update-status/${inputId}`, {
        status: 'completed'
      });
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error memperbarui status');
    }
  };

  const handleSubmitMoGroup = async (moNumber, sessionId) => {
    const session = savedData.find(s => s.session_id === sessionId);
    if (!session) return;

    const inputsWithSameMo = session.inputs.filter(input => input.mo_number === moNumber && input.status === 'active');
    if (inputsWithSameMo.length === 0) {
      alert('Tidak ada input aktif untuk disubmit pada MO ini');
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin submit semua ${inputsWithSameMo.length} input untuk MO ${moNumber}?`)) {
      return;
    }

    try {
      const updatePromises = inputsWithSameMo.map(input => 
        axios.put(`/api/production/liquid/update-status/${input.id}`, {
          status: 'completed'
        })
      );
      
      await Promise.all(updatePromises);
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error memperbarui status');
    }
  };

  const handleSubmitAllPending = async (sessionId) => {
    const session = savedData.find(s => s.session_id === sessionId);
    if (!session) return;

    // Get all active inputs grouped by MO number
    const groupedByMo = {};
    session.inputs.forEach(input => {
      if (input.status === 'active') {
        if (!groupedByMo[input.mo_number]) {
          groupedByMo[input.mo_number] = [];
        }
        groupedByMo[input.mo_number].push(input);
      }
    });

    const allActiveInputs = session.inputs.filter(input => input.status === 'active');
    
    if (allActiveInputs.length === 0) {
      alert('Tidak ada MO yang tertunda untuk disubmit');
      return;
    }

    const moNumbers = Object.keys(groupedByMo);
    const confirmMessage = `Apakah Anda yakin ingin submit semua ${allActiveInputs.length} input yang tertunda dari ${moNumbers.length} MO dalam session ini?\n\nMO Numbers: ${moNumbers.join(', ')}`;
    
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      const updatePromises = allActiveInputs.map(input => 
        axios.put(`/api/production/liquid/update-status/${input.id}`, {
          status: 'completed'
        })
      );
      
      await Promise.all(updatePromises);
      fetchData();
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error memperbarui status');
    }
  };

  const handleEditInput = (moNumber, sessionId) => {
    // Find all inputs with the same MO number in the same session
    const session = savedData.find(s => s.session_id === sessionId);
    if (!session) return;
    
    const inputsWithSameMo = session.inputs.filter(input => input.mo_number === moNumber);
    if (inputsWithSameMo.length === 0) return;
    
    // Collect all authenticity data from all inputs
    const allAuthenticityRows = [];
    const uniquePics = new Set();
    
    inputsWithSameMo.forEach(input => {
      uniquePics.add(input.pic);
      if (input.authenticity_data && Array.isArray(input.authenticity_data)) {
        input.authenticity_data.forEach(auth => {
          allAuthenticityRows.push({
            firstAuthenticity: auth.firstAuthenticity || '',
            lastAuthenticity: auth.lastAuthenticity || '',
            rollNumber: auth.rollNumber || ''
          });
        });
      }
    });
    
    // Use the first input as base for other fields
    const firstInput = inputsWithSameMo[0];
    
    setEditingMoNumber(moNumber);
    setEditingSessionId(sessionId);
    setEditingInput(inputsWithSameMo.map(input => input.id).join(','));
    setEditFormData({
      pic: Array.from(uniquePics).join(', '),
      moNumber: firstInput.mo_number,
      skuName: firstInput.sku_name,
      authenticityRows: allAuthenticityRows.length > 0 ? allAuthenticityRows : [{ firstAuthenticity: '', lastAuthenticity: '', rollNumber: '' }],
      inputIds: inputsWithSameMo.map(input => input.id)
    });
  };

  const handleCancelEdit = () => {
    setEditingInput(null);
    setEditFormData(null);
    setEditingMoNumber(null);
    setEditingSessionId(null);
  };

  const handleSaveEdit = async () => {
    if (!editFormData.pic || !editFormData.moNumber || !editFormData.skuName) {
      alert('Silakan isi semua field yang wajib diisi');
      return;
    }

    if (!editFormData.inputIds || editFormData.inputIds.length === 0) {
      alert('Tidak ada input untuk diperbarui');
      return;
    }

    try {
      // Update first input with all authenticity data, others with empty array to prevent duplication
      const updatePromises = editFormData.inputIds.map((inputId, index) => 
        axios.put(`/api/production/liquid/${inputId}`, {
          pic: editFormData.pic.split(',')[0].trim(), // Use first PIC if multiple
          mo_number: editFormData.moNumber,
          sku_name: editFormData.skuName,
          authenticity_data: index === 0 ? editFormData.authenticityRows : [] // Only first input gets all data
        })
      );
      
      await Promise.all(updatePromises);
      
      setEditingInput(null);
      setEditFormData(null);
      setEditingMoNumber(null);
      setEditingSessionId(null);
      fetchData();
    } catch (error) {
      console.error('Error updating data:', error);
      alert('Error memperbarui data');
    }
  };

  const handleEditRowChange = (index, field, value) => {
    const newRows = [...editFormData.authenticityRows];
    newRows[index][field] = value;
    setEditFormData({
      ...editFormData,
      authenticityRows: newRows
    });
  };

  const handleAddEditRow = () => {
    setEditFormData({
      ...editFormData,
      authenticityRows: [
        ...editFormData.authenticityRows,
        { firstAuthenticity: '', lastAuthenticity: '', rollNumber: '' }
      ]
    });
  };

  const handleDeleteEditRow = (index) => {
    if (editFormData.authenticityRows.length > 1) {
      const newRows = editFormData.authenticityRows.filter((_, i) => i !== index);
      setEditFormData({
        ...editFormData,
        authenticityRows: newRows
      });
    }
  };

  return (
    <div className="production-container">
      <div className="production-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">
          ← Back to Dashboard
        </button>
        <h1>Production Liquid</h1>
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
              <button onClick={handleInputReject} className="reject-button">
                Input Reject Authenticity
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
              {savedData.map((session) => {
                // Group inputs by MO Number to check status
                const groupedByMo = {};
                session.inputs.forEach(input => {
                  if (!groupedByMo[input.mo_number]) {
                    groupedByMo[input.mo_number] = [];
                  }
                  groupedByMo[input.mo_number].push(input);
                });

                // Check if all MO groups are completed
                const allMoGroupsCompleted = Object.entries(groupedByMo).every(([moNumber, inputs]) => 
                  inputs.every(input => input.status === 'completed')
                );
                
                // Count active inputs
                const activeInputsCount = session.inputs.filter(input => input.status === 'active').length;
                const pendingMoCount = Object.entries(groupedByMo).filter(([moNumber, inputs]) => 
                  inputs.some(input => input.status === 'active')
                ).length;

                const sessionStatus = allMoGroupsCompleted ? 'completed' : 'active';

                return (
                <div key={session.session_id} className={`data-item ${sessionStatus === 'completed' ? 'completed' : 'active'}`}>
                  <div className="data-header">
                    <div>
                      <h3>Session: {session.leader_name} - Shift {session.shift_number}</h3>
                      <span className={`status-badge ${sessionStatus}`}>
                        {sessionStatus === 'completed' ? 'Completed' : 'Active'}
                      </span>
                    </div>
                    <span className="date">{formatDateIndonesia(session.created_at)}</span>
                  </div>
                  <div className="data-details">
                    <div className="data-details-info-row">
                      <p><strong>Leader:</strong> {session.leader_name}</p>
                      <p><strong>Shift:</strong> {session.shift_number}</p>
                      <p><strong>Total Inputs:</strong> {session.inputs.length}</p>
                      {!allMoGroupsCompleted && (
                        <p><strong>Pending MOs:</strong> {pendingMoCount}</p>
                      )}
                    </div>
                    {!allMoGroupsCompleted && activeInputsCount > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        <button
                          onClick={() => handleSubmitAllPending(session.session_id)}
                          className="submit-all-button"
                          style={{ 
                            padding: '8px 16px', 
                            fontSize: '14px', 
                            background: '#dc2626', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          Submit All Pending MO ({pendingMoCount})
                        </button>
                      </div>
                    )}
                    
                    <div className="inputs-container">
                      {Object.entries(groupedByMo).map(([moNumber, inputs], moIdx) => {
                        // Collect all authenticity data from all inputs in this MO group
                        const allAuthenticityData = [];
                        const activeInputs = [];
                        const uniquePics = new Set();
                        const seenAuthKeys = new Set(); // To track duplicates
                        
                        inputs.forEach(input => {
                          uniquePics.add(input.pic);
                          if (input.status === 'active') {
                            activeInputs.push(input);
                          }
                          if (input.authenticity_data && Array.isArray(input.authenticity_data)) {
                            input.authenticity_data.forEach(auth => {
                              // Create a unique key for this authenticity entry
                              const authKey = `${auth.firstAuthenticity || ''}_${auth.lastAuthenticity || ''}_${auth.rollNumber || ''}`;
                              // Only add if we haven't seen this combination before
                              if (!seenAuthKeys.has(authKey)) {
                                seenAuthKeys.add(authKey);
                                allAuthenticityData.push(auth);
                              }
                            });
                          }
                        });

                        // Check if this MO group is completed
                        const isMoGroupCompleted = inputs.every(input => input.status === 'completed');
                        const moGroupStatus = isMoGroupCompleted ? 'completed' : 'active';

                        // Check if this MO group is being edited
                        const isEditing = editingMoNumber === moNumber && editingSessionId === session.session_id;

                        return (
                          <div key={moNumber} className="mo-group-card">
                            <div className="mo-group-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong>MO Number:</strong> {moNumber}
                                <span className="mo-sku-badge">{inputs[0].sku_name}</span>
                              </div>
                              <span className={`status-badge ${moGroupStatus}`} style={{ marginLeft: 'auto' }}>
                                {moGroupStatus === 'completed' ? 'Completed' : 'Active'}
                              </span>
                            </div>
                            <div className="input-card">
                              <div className="input-card-header">
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  {activeInputs.length > 0 && !isEditing && (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                      <button
                                        onClick={() => handleSubmitMoGroup(moNumber, session.session_id)}
                                        className="submit-button"
                                        style={{ padding: '6px 12px', fontSize: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                      >
                                        Submit MO
                                      </button>
                                      <button
                                        onClick={() => handleEditInput(moNumber, session.session_id)}
                                        className="edit-button"
                                        style={{ padding: '6px 12px', fontSize: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                      >
                                        Edit
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                                <div className="input-card-body">
                                  {isEditing ? (
                                    <div className="edit-form">
                                      <div className="form-group" style={{ marginBottom: '12px' }}>
                                        <label>PIC *</label>
                                        <input
                                          type="text"
                                          value={editFormData.pic}
                                          onChange={(e) => setEditFormData({ ...editFormData, pic: e.target.value })}
                                          style={{ width: '100%', padding: '6px' }}
                                        />
                                      </div>
                                      <div className="form-group" style={{ marginBottom: '12px' }}>
                                        <label>MO Number *</label>
                                        <input
                                          type="text"
                                          value={editFormData.moNumber}
                                          onChange={(e) => setEditFormData({ ...editFormData, moNumber: e.target.value })}
                                          style={{ width: '100%', padding: '6px' }}
                                        />
                                      </div>
                                      <div className="form-group" style={{ marginBottom: '12px' }}>
                                        <label>SKU Name *</label>
                                        <input
                                          type="text"
                                          value={editFormData.skuName}
                                          onChange={(e) => setEditFormData({ ...editFormData, skuName: e.target.value })}
                                          style={{ width: '100%', padding: '6px' }}
                                        />
                                      </div>
                                      <div className="authenticity-section">
                                        <label>Authenticity Data</label>
                                        {editFormData.authenticityRows.map((row, rowIdx) => (
                                          <div key={rowIdx} className="authenticity-row-input" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                            <input
                                              type="text"
                                              placeholder="First Authenticity"
                                              value={row.firstAuthenticity}
                                              onChange={(e) => handleEditRowChange(rowIdx, 'firstAuthenticity', e.target.value)}
                                              style={{ flex: 1, padding: '6px' }}
                                            />
                                            <input
                                              type="text"
                                              placeholder="Last Authenticity"
                                              value={row.lastAuthenticity}
                                              onChange={(e) => handleEditRowChange(rowIdx, 'lastAuthenticity', e.target.value)}
                                              style={{ flex: 1, padding: '6px' }}
                                            />
                                            <input
                                              type="text"
                                              placeholder="Roll Number"
                                              value={row.rollNumber}
                                              onChange={(e) => handleEditRowChange(rowIdx, 'rollNumber', e.target.value)}
                                              style={{ flex: 1, padding: '6px' }}
                                            />
                                            {editFormData.authenticityRows.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteEditRow(rowIdx)}
                                                className="delete-row-button"
                                                style={{ padding: '6px 12px' }}
                                              >
                                                ×
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                        <button onClick={handleAddEditRow} className="add-row-button" style={{ marginTop: '8px' }}>
                                          + Add Row
                                        </button>
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                        <button
                                          onClick={handleSaveEdit}
                                          className="confirm-button"
                                          style={{ padding: '8px 16px' }}
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={handleCancelEdit}
                                          className="cancel-button"
                                          style={{ padding: '8px 16px' }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="input-card-info-row">
                                        <p><strong>PIC:</strong> {Array.from(uniquePics).join(', ')}</p>
                                      </div>
                                      <div className="authenticity-list">
                                        <strong>Authenticity Data:</strong>
                                        {allAuthenticityData.map((row, rowIdx) => (
                                          <div key={rowIdx} className="authenticity-row">
                                            <span>First: {row.firstAuthenticity}</span>
                                            <span>Last: {row.lastAuthenticity}</span>
                                            <span>Roll: {row.rollNumber}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              
                              {/* Buffer and Reject data shown once per MO */}
                              {bufferDataMap[moNumber] && bufferDataMap[moNumber].length > 0 && (
                                <div className="buffer-card">
                                  <div className="buffer-card-header">
                                    <strong>Buffer Authenticity</strong>
                                    <button 
                                      className="edit-button"
                                      onClick={() => {
                                        const firstBuffer = bufferDataMap[moNumber][0];
                                        setEditingBuffer(firstBuffer);
                                        setEditBufferData({
                                          pic: firstBuffer.pic,
                                          moNumber: firstBuffer.mo_number,
                                          skuName: firstBuffer.sku_name,
                                          authenticityNumbers: [...firstBuffer.authenticity_numbers]
                                        });
                                      }}
                                      title="Edit Buffer"
                                    >
                                      ✏️ Edit
                                    </button>
                                  </div>
                                  <div className="buffer-card-body">
                                    {bufferDataMap[moNumber].map((buffer, bufferIdx) => (
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
                              {rejectDataMap[moNumber] && rejectDataMap[moNumber].length > 0 && (
                                <div className="reject-card">
                                  <div className="reject-card-header">
                                    <strong>Reject Authenticity</strong>
                                    <button 
                                      className="edit-button"
                                      onClick={() => {
                                        const firstReject = rejectDataMap[moNumber][0];
                                        setEditingReject(firstReject);
                                        setEditRejectData({
                                          pic: firstReject.pic,
                                          moNumber: firstReject.mo_number,
                                          skuName: firstReject.sku_name,
                                          authenticityNumbers: [...firstReject.authenticity_numbers]
                                        });
                                      }}
                                      title="Edit Reject"
                                    >
                                      ✏️ Edit
                                    </button>
                                  </div>
                                  <div className="reject-card-body">
                                    {rejectDataMap[moNumber].map((reject, rejectIdx) => (
                                      <div key={reject.id} className="reject-item">
                                        <div className="reject-info">
                                          <span><strong>PIC:</strong> {reject.pic}</span>
                                          <span><strong>SKU:</strong> {reject.sku_name}</span>
                                        </div>
                                        <div className="reject-numbers">
                                          {reject.authenticity_numbers.map((num, numIdx) => (
                                            <span key={numIdx} className="reject-number">{num}</span>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
                );
              })}
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
                <option value="Bagas Prasetya">Bagas Prasetya</option>
                <option value="Ilyas Safiq">Ilyas Safiq</option>
                <option value="Ardani Bin Akmad">Ardani Bin Akmad</option>
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
        <div className="modal-overlay" onClick={() => {
          setShowInputModal(false);
          setMoSearchTerm('');
          setSelectedMo(null);
        }}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Input Authenticity Label Process</h2>
            <div className="form-group">
              <label>PIC *</label>
              <input
                type="text"
                list="pic-datalist-liquid"
                value={formData.pic}
                onChange={(e) => {
                  setFormData({ ...formData, pic: e.target.value });
                  setPicSearchTerm(e.target.value);
                }}
                placeholder="Ketik untuk mencari atau pilih PIC..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="pic-datalist-liquid">
                {picList
                  .filter(pic => 
                    pic.name.toLowerCase().includes((formData.pic || '').toLowerCase())
                  )
                  .map((pic) => (
                    <option key={pic.id} value={pic.name}>
                      {pic.name}
                    </option>
                  ))
                }
              </datalist>
            </div>
            <div className="form-group">
              <label>MO Number *</label>
              <input
                type="text"
                list="mo-datalist-liquid"
                value={moSearchTerm}
                onChange={(e) => {
                  setMoSearchTerm(e.target.value);
                  // Auto-select if exact match
                  const exactMatch = moList.find(mo => 
                    mo.mo_number === e.target.value || 
                    `${mo.mo_number} - ${mo.sku_name}` === e.target.value
                  );
                  if (exactMatch) {
                    handleMoChange(exactMatch.mo_number);
                  } else {
                    setSelectedMo(null);
                    setFormData({ ...formData, moNumber: '', skuName: '' });
                  }
                }}
                placeholder="Type to search MO Number or SKU Name..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="mo-datalist-liquid">
                {moList
                  .filter(mo => 
                    moSearchTerm === '' ||
                    mo.mo_number.toLowerCase().includes(moSearchTerm.toLowerCase()) ||
                    mo.sku_name.toLowerCase().includes(moSearchTerm.toLowerCase())
                  )
                  .map((mo) => (
                    <option key={mo.mo_number} value={mo.mo_number}>
                      {mo.mo_number} - {mo.sku_name}
                    </option>
                  ))
                }
              </datalist>
              {selectedMo && (
                <div className="mo-info-display">
                  <p><strong>SKU Name:</strong> {selectedMo.sku_name}</p>
                  <p><strong>Quantity:</strong> {selectedMo.quantity} {selectedMo.uom}</p>
                  <p><strong>Created:</strong> {formatDateIndonesia(selectedMo.create_date)}</p>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>SKU Name *</label>
              <input
                type="text"
                value={formData.skuName}
                onChange={(e) => setFormData({ ...formData, skuName: e.target.value })}
                placeholder="Enter SKU Name"
                readOnly={selectedMo !== null}
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
                    onKeyDown={(e) => handleScannerKeyDown(e, index, 'firstAuthenticity')}
                  />
                  <input
                    type="text"
                    placeholder="Last Authenticity at"
                    value={row.lastAuthenticity}
                    onChange={(e) => handleRowChange(index, 'lastAuthenticity', e.target.value)}
                    onKeyDown={(e) => handleScannerKeyDown(e, index, 'lastAuthenticity')}
                  />
                  <input
                    type="text"
                    placeholder="Roll Number"
                    value={row.rollNumber}
                    onChange={(e) => handleRowChange(index, 'rollNumber', e.target.value)}
                    onKeyDown={(e) => handleScannerKeyDown(e, index, 'rollNumber')}
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
              <button onClick={() => {
                setShowInputModal(false);
                setMoSearchTerm('');
                setSelectedMo(null);
              }} className="cancel-button">
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
                list="pic-datalist-buffer-liquid"
                value={bufferData.pic}
                onChange={(e) => setBufferData({ ...bufferData, pic: e.target.value })}
                placeholder="Ketik untuk mencari atau pilih PIC..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="pic-datalist-buffer-liquid">
                {picList
                  .filter(pic => 
                    pic.name.toLowerCase().includes((bufferData.pic || '').toLowerCase())
                  )
                  .map((pic) => (
                    <option key={pic.id} value={pic.name}>
                      {pic.name}
                    </option>
                  ))
                }
              </datalist>
            </div>
            <div className="form-group">
              <label>MO Number *</label>
              <input
                type="text"
                list="mo-datalist-buffer-liquid"
                value={bufferMoSearchTerm}
                onChange={(e) => {
                  setBufferMoSearchTerm(e.target.value);
                  // Auto-select if exact match
                  const exactMatch = moList.find(mo => 
                    mo.mo_number === e.target.value || 
                    `${mo.mo_number} - ${mo.sku_name}` === e.target.value
                  );
                  if (exactMatch) {
                    handleBufferMoChange(exactMatch.mo_number);
                  } else {
                    setSelectedBufferMo(null);
                    setBufferData({ ...bufferData, moNumber: '', skuName: '' });
                  }
                }}
                placeholder="Type to search MO Number or SKU Name..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="mo-datalist-buffer-liquid">
                {moList
                  .filter(mo => 
                    bufferMoSearchTerm === '' ||
                    mo.mo_number.toLowerCase().includes(bufferMoSearchTerm.toLowerCase()) ||
                    mo.sku_name.toLowerCase().includes(bufferMoSearchTerm.toLowerCase())
                  )
                  .map((mo) => (
                    <option key={mo.mo_number} value={mo.mo_number}>
                      {mo.mo_number} - {mo.sku_name}
                    </option>
                  ))
                }
              </datalist>
              {selectedBufferMo && (
                <div className="mo-info-display">
                  <p><strong>SKU Name:</strong> {selectedBufferMo.sku_name}</p>
                  <p><strong>Quantity:</strong> {selectedBufferMo.quantity} {selectedBufferMo.uom}</p>
                  <p><strong>Created:</strong> {formatDateIndonesia(selectedBufferMo.create_date)}</p>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>SKU Name *</label>
              <input
                type="text"
                value={bufferData.skuName}
                onChange={(e) => setBufferData({ ...bufferData, skuName: e.target.value })}
                placeholder="Enter SKU Name"
                readOnly={selectedBufferMo !== null}
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
                    onKeyDown={(e) => handleBufferScannerKeyDown(e, index)}
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

      {/* Input Reject Authenticity Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(false)}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Input Reject Authenticity</h2>
            <div className="form-group">
              <label>Nama PIC *</label>
              <input
                type="text"
                list="pic-datalist-reject-liquid"
                value={rejectData.pic}
                onChange={(e) => setRejectData({ ...rejectData, pic: e.target.value })}
                placeholder="Ketik untuk mencari atau pilih PIC..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="pic-datalist-reject-liquid">
                {picList
                  .filter(pic => 
                    pic.name.toLowerCase().includes((rejectData.pic || '').toLowerCase())
                  )
                  .map((pic) => (
                    <option key={pic.id} value={pic.name}>
                      {pic.name}
                    </option>
                  ))
                }
              </datalist>
            </div>
            <div className="form-group">
              <label>MO Number *</label>
              <input
                type="text"
                list="mo-datalist-reject-liquid"
                value={rejectMoSearchTerm}
                onChange={(e) => {
                  setRejectMoSearchTerm(e.target.value);
                  // Auto-select if exact match
                  const exactMatch = moList.find(mo => 
                    mo.mo_number === e.target.value || 
                    `${mo.mo_number} - ${mo.sku_name}` === e.target.value
                  );
                  if (exactMatch) {
                    handleRejectMoChange(exactMatch.mo_number);
                  } else {
                    setSelectedRejectMo(null);
                    setRejectData({ ...rejectData, moNumber: '', skuName: '' });
                  }
                }}
                placeholder="Type to search MO Number or SKU Name..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="mo-datalist-reject-liquid">
                {moList
                  .filter(mo => 
                    rejectMoSearchTerm === '' ||
                    mo.mo_number.toLowerCase().includes(rejectMoSearchTerm.toLowerCase()) ||
                    mo.sku_name.toLowerCase().includes(rejectMoSearchTerm.toLowerCase())
                  )
                  .map((mo) => (
                    <option key={mo.mo_number} value={mo.mo_number}>
                      {mo.mo_number} - {mo.sku_name}
                    </option>
                  ))
                }
              </datalist>
              {selectedRejectMo && (
                <div className="mo-info-display">
                  <p><strong>SKU Name:</strong> {selectedRejectMo.sku_name}</p>
                  <p><strong>Quantity:</strong> {selectedRejectMo.quantity} {selectedRejectMo.uom}</p>
                  <p><strong>Created:</strong> {formatDateIndonesia(selectedRejectMo.create_date)}</p>
                </div>
              )}
            </div>
            <div className="form-group">
              <label>SKU Name *</label>
              <input
                type="text"
                value={rejectData.skuName}
                onChange={(e) => setRejectData({ ...rejectData, skuName: e.target.value })}
                placeholder="Enter SKU Name"
                readOnly={selectedRejectMo !== null}
              />
            </div>
            <div className="authenticity-section">
              <label>Nomor Authenticity</label>
              {rejectData.authenticityNumbers.map((number, index) => (
                <div key={index} className="buffer-row-input">
                  <input
                    type="text"
                    placeholder="Enter authenticity number"
                    value={number}
                    onChange={(e) => handleRejectNumberChange(index, e.target.value)}
                    onKeyDown={(e) => handleRejectScannerKeyDown(e, index)}
                  />
                  {rejectData.authenticityNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleDeleteRejectNumber(index)}
                      className="delete-row-button"
                      title="Delete number"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button onClick={handleAddRejectNumber} className="add-row-button">
                + Add Number
              </button>
            </div>
            <div className="modal-buttons">
              <button onClick={() => setShowRejectModal(false)} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleConfirmReject} className="confirm-button">
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Buffer Modal */}
      {editingBuffer && editBufferData && (
        <div className="modal-overlay" onClick={() => {
          setEditingBuffer(null);
          setEditBufferData(null);
        }}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Buffer Authenticity</h2>
            <div className="form-group">
              <label>Nama PIC *</label>
              <input
                type="text"
                list="pic-datalist-edit-buffer-liquid"
                value={editBufferData.pic}
                onChange={(e) => setEditBufferData({ ...editBufferData, pic: e.target.value })}
                placeholder="Ketik untuk mencari atau pilih PIC..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="pic-datalist-edit-buffer-liquid">
                {picList
                  .filter(pic => 
                    pic.name.toLowerCase().includes((editBufferData.pic || '').toLowerCase())
                  )
                  .map((pic) => (
                    <option key={pic.id} value={pic.name}>
                      {pic.name}
                    </option>
                  ))
                }
              </datalist>
            </div>
            <div className="form-group">
              <label>MO Number *</label>
              <input
                type="text"
                value={editBufferData.moNumber}
                onChange={(e) => setEditBufferData({ ...editBufferData, moNumber: e.target.value })}
                placeholder="MO Number"
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
                readOnly
              />
            </div>
            <div className="form-group">
              <label>SKU Name *</label>
              <input
                type="text"
                value={editBufferData.skuName}
                onChange={(e) => setEditBufferData({ ...editBufferData, skuName: e.target.value })}
                placeholder="SKU Name"
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div className="form-group">
              <label>Authenticity Numbers *</label>
              {editBufferData.authenticityNumbers.map((num, index) => (
                <div key={index} className="buffer-row-input" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={num}
                    onChange={(e) => handleEditBufferNumberChange(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (index === editBufferData.authenticityNumbers.length - 1) {
                          handleAddEditBufferNumber();
                        }
                      }
                    }}
                    placeholder={`Authenticity Number ${index + 1}`}
                    style={{ flex: 1, padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  {editBufferData.authenticityNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEditBufferNumber(index)}
                      style={{ padding: '8px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddEditBufferNumber}
                style={{ marginTop: '8px', padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                + Tambah Nomor
              </button>
            </div>
            <div className="modal-buttons">
              <button onClick={() => {
                setEditingBuffer(null);
                setEditBufferData(null);
              }} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleUpdateBuffer} className="confirm-button">
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Reject Modal */}
      {editingReject && editRejectData && (
        <div className="modal-overlay" onClick={() => {
          setEditingReject(null);
          setEditRejectData(null);
        }}>
          <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Reject Authenticity</h2>
            <div className="form-group">
              <label>Nama PIC *</label>
              <input
                type="text"
                list="pic-datalist-edit-reject-liquid"
                value={editRejectData.pic}
                onChange={(e) => setEditRejectData({ ...editRejectData, pic: e.target.value })}
                placeholder="Ketik untuk mencari atau pilih PIC..."
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <datalist id="pic-datalist-edit-reject-liquid">
                {picList
                  .filter(pic => 
                    pic.name.toLowerCase().includes((editRejectData.pic || '').toLowerCase())
                  )
                  .map((pic) => (
                    <option key={pic.id} value={pic.name}>
                      {pic.name}
                    </option>
                  ))
                }
              </datalist>
            </div>
            <div className="form-group">
              <label>MO Number *</label>
              <input
                type="text"
                value={editRejectData.moNumber}
                onChange={(e) => setEditRejectData({ ...editRejectData, moNumber: e.target.value })}
                placeholder="MO Number"
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
                readOnly
              />
            </div>
            <div className="form-group">
              <label>SKU Name *</label>
              <input
                type="text"
                value={editRejectData.skuName}
                onChange={(e) => setEditRejectData({ ...editRejectData, skuName: e.target.value })}
                placeholder="SKU Name"
                style={{ width: '100%', padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
            </div>
            <div className="form-group">
              <label>Authenticity Numbers *</label>
              {editRejectData.authenticityNumbers.map((num, index) => (
                <div key={index} className="reject-row-input" style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={num}
                    onChange={(e) => handleEditRejectNumberChange(index, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (index === editRejectData.authenticityNumbers.length - 1) {
                          handleAddEditRejectNumber();
                        }
                      }
                    }}
                    placeholder={`Authenticity Number ${index + 1}`}
                    style={{ flex: 1, padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                  {editRejectData.authenticityNumbers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveEditRejectNumber(index)}
                      style={{ padding: '8px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      Hapus
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddEditRejectNumber}
                style={{ marginTop: '8px', padding: '8px 16px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                + Tambah Nomor
              </button>
            </div>
            <div className="modal-buttons">
              <button onClick={() => {
                setEditingReject(null);
                setEditRejectData(null);
              }} className="cancel-button">
                Cancel
              </button>
              <button onClick={handleUpdateReject} className="confirm-button">
                Update
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductionLiquid;


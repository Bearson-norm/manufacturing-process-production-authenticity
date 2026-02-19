import React, { useState, useEffect, useRef } from 'react';
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
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showButtonHelpModal, setShowButtonHelpModal] = useState(false);
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
  const [authenticityValidationStatus, setAuthenticityValidationStatus] = useState({});
  const [authenticityInvalidStatus, setAuthenticityInvalidStatus] = useState({});
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
  const [editAuthenticityValidationStatus, setEditAuthenticityValidationStatus] = useState({});
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
      // Validate shift number is numeric only
      if (shiftNumber.trim() !== '' && !/^\d+$/.test(shiftNumber.trim())) {
        alert('Shift Number hanya boleh berisi angka. Silakan periksa kembali input Anda.');
        return;
      }

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
    // Hanya terima data numerik
    const numericValue = value.replace(/\D/g, '');
    const newNumbers = [...bufferData.authenticityNumbers];
    newNumbers[index] = numericValue;
    setBufferData({
      ...bufferData,
      authenticityNumbers: newNumbers
    });
  };

  const handleBufferNumberBlur = (index) => {
    const currentValue = bufferData.authenticityNumbers[index]?.trim();
    if (!currentValue) return; // Skip validation if field is empty

    // Check for duplicates (excluding current index)
    const duplicates = bufferData.authenticityNumbers.filter(
      (num, idx) => idx !== index && num.trim() === currentValue && num.trim() !== ''
    );

    if (duplicates.length > 0) {
      // Clear the duplicate value
      const newNumbers = [...bufferData.authenticityNumbers];
      newNumbers[index] = '';
      setBufferData({
        ...bufferData,
        authenticityNumbers: newNumbers
      });
      alert(`Nomor authenticity "${currentValue}" sudah ada. Nomor tidak dapat duplikat.`);
    }
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
    // Hanya terima data numerik
    const numericValue = value.replace(/\D/g, '');
    const newNumbers = [...rejectData.authenticityNumbers];
    newNumbers[index] = numericValue;
    setRejectData({
      ...rejectData,
      authenticityNumbers: newNumbers
    });
  };

  const handleRejectNumberBlur = (index) => {
    const currentValue = rejectData.authenticityNumbers[index]?.trim();
    if (!currentValue) return; // Skip validation if field is empty

    // Check for duplicates (excluding current index)
    const duplicates = rejectData.authenticityNumbers.filter(
      (num, idx) => idx !== index && num.trim() === currentValue && num.trim() !== ''
    );

    if (duplicates.length > 0) {
      // Clear the duplicate value
      const newNumbers = [...rejectData.authenticityNumbers];
      newNumbers[index] = '';
      setRejectData({
        ...rejectData,
        authenticityNumbers: newNumbers
      });
      alert(`Nomor authenticity "${currentValue}" sudah ada. Nomor tidak dapat duplikat.`);
    }
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
    // Hanya terima data numerik
    const numericValue = value.replace(/\D/g, '');
    const newNumbers = [...editBufferData.authenticityNumbers];
    newNumbers[index] = numericValue;
    setEditBufferData({
      ...editBufferData,
      authenticityNumbers: newNumbers
    });
  };

  const handleEditBufferNumberBlur = (index) => {
    const currentValue = editBufferData.authenticityNumbers[index]?.trim();
    if (!currentValue) return; // Skip validation if field is empty

    // Check for duplicates (excluding current index)
    const duplicates = editBufferData.authenticityNumbers.filter(
      (num, idx) => idx !== index && num.trim() === currentValue && num.trim() !== ''
    );

    if (duplicates.length > 0) {
      // Clear the duplicate value
      const newNumbers = [...editBufferData.authenticityNumbers];
      newNumbers[index] = '';
      setEditBufferData({
        ...editBufferData,
        authenticityNumbers: newNumbers
      });
      alert(`Nomor authenticity "${currentValue}" sudah ada. Nomor tidak dapat duplikat.`);
    }
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
    // Hanya terima data numerik
    const numericValue = value.replace(/\D/g, '');
    const newNumbers = [...editRejectData.authenticityNumbers];
    newNumbers[index] = numericValue;
    setEditRejectData({
      ...editRejectData,
      authenticityNumbers: newNumbers
    });
  };

  const handleEditRejectNumberBlur = (index) => {
    const currentValue = editRejectData.authenticityNumbers[index]?.trim();
    if (!currentValue) return; // Skip validation if field is empty

    // Check for duplicates (excluding current index)
    const duplicates = editRejectData.authenticityNumbers.filter(
      (num, idx) => idx !== index && num.trim() === currentValue && num.trim() !== ''
    );

    if (duplicates.length > 0) {
      // Clear the duplicate value
      const newNumbers = [...editRejectData.authenticityNumbers];
      newNumbers[index] = '';
      setEditRejectData({
        ...editRejectData,
        authenticityNumbers: newNumbers
      });
      alert(`Nomor authenticity "${currentValue}" sudah ada. Nomor tidak dapat duplikat.`);
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

  const validateAuthenticityRow = (index, firstAuth, lastAuth, isEdit = false) => {
    // Skip validation if fields are empty
    if (!firstAuth || !lastAuth || firstAuth.trim() === '' || lastAuth.trim() === '') {
      // Clear invalid status for empty fields
      if (!isEdit) {
        setAuthenticityInvalidStatus(prev => {
          const newStatus = { ...prev };
          delete newStatus[index];
          return newStatus;
        });
      }
      return { valid: true, message: '' }; // Allow empty fields
    }

    const first = parseInt(firstAuth);
    const last = parseInt(lastAuth);

    // Check if values are valid numbers
    if (isNaN(first) || isNaN(last)) {
      if (!isEdit) {
        setAuthenticityInvalidStatus(prev => ({
          ...prev,
          [index]: 'First dan Last Authenticity harus berupa angka'
        }));
      }
      return { valid: false, message: 'First dan Last Authenticity harus berupa angka' };
    }

    const difference = last - first;

    // Check if difference is negative
    if (difference < 0) {
      if (!isEdit) {
        setAuthenticityInvalidStatus(prev => ({
          ...prev,
          [index]: 'Selisih tidak boleh negatif'
        }));
      }
      return { valid: false, message: 'Selisih tidak boleh negatif' };
    }

    // Check if First and Last Authenticity are the same
    if (difference === 0) {
      if (!isEdit) {
        setAuthenticityInvalidStatus(prev => ({
          ...prev,
          [index]: 'First dan Last Authenticity tidak boleh sama'
        }));
      }
      return { valid: false, message: 'First dan Last Authenticity tidak boleh sama' };
    }

    // Check if difference is more than 7000
    if (difference > 7000) {
      if (!isEdit) {
        setAuthenticityInvalidStatus(prev => ({
          ...prev,
          [index]: 'Selisih tidak boleh lebih dari 7000'
        }));
      }
      return { valid: false, message: 'Selisih tidak boleh lebih dari 7000' };
    }

    // Valid - clear invalid status
    if (isEdit) {
      setEditAuthenticityValidationStatus(prev => ({
        ...prev,
        [index]: true
      }));
    } else {
      setAuthenticityValidationStatus(prev => ({
        ...prev,
        [index]: true
      }));
      setAuthenticityInvalidStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[index];
        return newStatus;
      });
    }

    return { valid: true, message: 'Valid' };
  };

  // Track if alert has been shown to prevent duplicate alerts
  const validationAlertShown = useRef({});

  const handleValidateRow = (index, isEdit = false, showAlert = true) => {
    const rows = isEdit ? editFormData.authenticityRows : formData.authenticityRows;
    const row = rows[index];
    
    if (!row) return;

    const result = validateAuthenticityRow(index, row.firstAuthenticity, row.lastAuthenticity, isEdit);
    
    if (!result.valid) {
      const key = `${isEdit ? 'edit' : 'main'}_${index}`;
      
      // Only show alert if it hasn't been shown recently for this row
      if (showAlert && !validationAlertShown.current[key]) {
        alert(result.message);
        validationAlertShown.current[key] = true;
        
        // Reset flag after a delay to allow re-validation if user fixes the issue
        setTimeout(() => {
          validationAlertShown.current[key] = false;
        }, 3000);
      }
      
      if (isEdit) {
        setEditAuthenticityValidationStatus(prev => ({
          ...prev,
          [index]: false
        }));
      } else {
        setAuthenticityValidationStatus(prev => ({
          ...prev,
          [index]: false
        }));
      }
    } else {
      // Reset alert flag if validation passes
      const key = `${isEdit ? 'edit' : 'main'}_${index}`;
      validationAlertShown.current[key] = false;
    }
  };

  // Auto-validate on blur - only show alert once
  const handleAuthenticityBlur = (index, isEdit = false) => {
    const rows = isEdit ? editFormData.authenticityRows : formData.authenticityRows;
    const row = rows[index];
    
    if (!row) return;
    
    // Only validate if both fields have values
    const hasFirst = row.firstAuthenticity && row.firstAuthenticity.trim() !== '';
    const hasLast = row.lastAuthenticity && row.lastAuthenticity.trim() !== '';
    
    // Only validate when both fields are filled
    if (hasFirst && hasLast) {
      // Use a small delay to prevent duplicate validation when blurring from one field to another
      const key = `${isEdit ? 'edit' : 'main'}_${index}`;
      
      // Clear any existing timeout for this row
      if (validationAlertShown.current[`timeout_${key}`]) {
        clearTimeout(validationAlertShown.current[`timeout_${key}`]);
      }
      
      // Validate after a short delay to ensure both blur events are processed
      validationAlertShown.current[`timeout_${key}`] = setTimeout(() => {
        handleValidateRow(index, isEdit, true);
        delete validationAlertShown.current[`timeout_${key}`];
      }, 150);
    }
  };

  const handleDeleteRow = (index) => {
    if (formData.authenticityRows.length > 1) {
      const newRows = formData.authenticityRows.filter((_, i) => i !== index);
      setFormData({
        ...formData,
        authenticityRows: newRows
      });
      // Remove validation status for deleted row
      const newValidationStatus = { ...authenticityValidationStatus };
      delete newValidationStatus[index];
      // Reindex remaining validations
      const reindexed = {};
      Object.keys(newValidationStatus).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum > index) {
          reindexed[keyNum - 1] = newValidationStatus[key];
        } else if (keyNum < index) {
          reindexed[keyNum] = newValidationStatus[key];
        }
      });
      setAuthenticityValidationStatus(reindexed);
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...formData.authenticityRows];
    newRows[index][field] = value;
    
    // Auto-calculate Last Authenticity when First Authenticity is entered
    if (field === 'firstAuthenticity' && value.trim() !== '') {
      const firstNum = parseInt(value);
      if (!isNaN(firstNum) && (!newRows[index].lastAuthenticity || newRows[index].lastAuthenticity.trim() === '')) {
        // Calculate Last = First + rollNumber (if rollNumber exists and is valid), otherwise First + 1
        const rollNum = parseInt(newRows[index].rollNumber);
        const calculatedLast = rollNum && !isNaN(rollNum) && rollNum > 0 
          ? firstNum + rollNum 
          : firstNum + 1;
        newRows[index].lastAuthenticity = calculatedLast.toString();
      }
    }
    
    // Recalculate Last Authenticity when rollNumber changes (if First is set and Last is empty)
    if (field === 'rollNumber') {
      const firstValue = newRows[index].firstAuthenticity;
      if (firstValue && firstValue.trim() !== '') {
        const firstNum = parseInt(firstValue);
        if (!isNaN(firstNum) && (!newRows[index].lastAuthenticity || newRows[index].lastAuthenticity.trim() === '')) {
          const rollNum = parseInt(value);
          const calculatedLast = rollNum && !isNaN(rollNum) && rollNum > 0 
            ? firstNum + rollNum 
            : firstNum + 1;
          newRows[index].lastAuthenticity = calculatedLast.toString();
        }
      }
    }
    
    setFormData({
      ...formData,
      authenticityRows: newRows
    });
    
    // Reset validation status when field changes
    if (field === 'firstAuthenticity' || field === 'lastAuthenticity') {
      setAuthenticityValidationStatus(prev => ({
        ...prev,
        [index]: false
      }));
      // Clear invalid status when field changes
      setAuthenticityInvalidStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[index];
        return newStatus;
      });
    }
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

    // Check if all non-empty rows are validated
    const rowsToValidate = formData.authenticityRows.filter((row, idx) => {
      const hasFirst = row.firstAuthenticity && row.firstAuthenticity.trim() !== '';
      const hasLast = row.lastAuthenticity && row.lastAuthenticity.trim() !== '';
      return hasFirst || hasLast;
    });

    if (rowsToValidate.length > 0) {
      // Check if roll number is filled for rows with authenticity data
      const rowsWithMissingRollNumber = rowsToValidate.filter((row, idx) => {
        return !row.rollNumber || row.rollNumber.trim() === '';
      });

      if (rowsWithMissingRollNumber.length > 0) {
        alert('Nomor roll tidak boleh kosong. Silakan isi nomor roll untuk semua row yang memiliki data authenticity.');
        return;
      }

      // Check validation status but don't block confirm - just show warning
      const allValidated = rowsToValidate.every((row, idx) => {
        const originalIndex = formData.authenticityRows.findIndex(r => r === row);
        return authenticityValidationStatus[originalIndex] === true;
      });

      if (!allValidated) {
        // Show warning but allow confirm
        const hasInvalid = rowsToValidate.some((row, idx) => {
          const originalIndex = formData.authenticityRows.findIndex(r => r === row);
          return authenticityInvalidStatus[originalIndex];
        });
        
        if (hasInvalid) {
          const proceed = window.confirm('Ada authenticity data yang belum valid. Data yang tidak valid tidak akan bisa disubmit. Apakah Anda yakin ingin melanjutkan?');
          if (!proceed) {
            return;
          }
        }
      }
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
      setAuthenticityValidationStatus({});
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

  // Helper function to validate authenticity data for submit
  const validateAuthenticityData = (inputs) => {
    for (const input of inputs) {
      if (input.authenticity_data && Array.isArray(input.authenticity_data)) {
        for (const auth of input.authenticity_data) {
          const firstAuth = auth.firstAuthenticity || '';
          const lastAuth = auth.lastAuthenticity || '';
          
          // Check if either first or last authenticity is empty
          if (!firstAuth.trim() || !lastAuth.trim()) {
            return {
              valid: false,
              message: `MO ${input.mo_number}: Ada authenticity data yang kosong. Pastikan semua First dan Last Authenticity sudah diisi.`
            };
          }
          
          // Validate the authenticity values
          const first = parseInt(firstAuth);
          const last = parseInt(lastAuth);
          
          if (isNaN(first) || isNaN(last)) {
            return {
              valid: false,
              message: `MO ${input.mo_number}: First dan Last Authenticity harus berupa angka.`
            };
          }
          
          const difference = last - first;
          
          if (difference < 0) {
            return {
              valid: false,
              message: `MO ${input.mo_number}: Selisih authenticity tidak boleh negatif.`
            };
          }
          
          if (difference === 0) {
            return {
              valid: false,
              message: `MO ${input.mo_number}: First dan Last Authenticity tidak boleh sama.`
            };
          }
          
          if (difference > 7000) {
            return {
              valid: false,
              message: `MO ${input.mo_number}: Selisih authenticity tidak boleh lebih dari 7000.`
            };
          }
        }
      } else {
        // If no authenticity_data or empty array
        return {
          valid: false,
          message: `MO ${input.mo_number}: Tidak ada authenticity data. Pastikan authenticity data sudah diisi.`
        };
      }
    }
    return { valid: true };
  };

  const handleSubmitMoGroup = async (moNumber, sessionId) => {
    const session = savedData.find(s => s.session_id === sessionId);
    if (!session) return;

    const inputsWithSameMo = session.inputs.filter(input => input.mo_number === moNumber && input.status === 'active');
    if (inputsWithSameMo.length === 0) {
      alert('Tidak ada input aktif untuk disubmit pada MO ini');
      return;
    }

    // Validate: Check if all inputs for this MO are active (active_count == 0 for this session)
    // This is a frontend validation - backend will also check
    const allInputsForMo = session.inputs.filter(input => input.mo_number === moNumber);
    const activeInputsForMo = allInputsForMo.filter(input => input.status === 'active');
    
    // Only allow submit if all inputs for this MO in this session are active (no completed ones)
    // Note: There might be other inputs with same MO in other sessions, but we check that in backend
    if (activeInputsForMo.length !== allInputsForMo.length) {
      alert(`Tidak dapat submit MO ${moNumber}. Masih ada input dengan status completed di session ini.`);
      return;
    }

    // Validate authenticity data before submit
    const validation = validateAuthenticityData(inputsWithSameMo);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin submit semua ${inputsWithSameMo.length} input untuk MO ${moNumber}?`)) {
      return;
    }

    try {
      // Use the new batch submit endpoint instead of individual updates
      // MO number is passed in body to handle special characters like '/'
      const response = await axios.put(`/api/production/liquid/submit-mo-group`, {
        mo_number: moNumber,
        session_id: sessionId
      });
      
      // Check if response has auto_reverted flag
      if (response.data && response.data.auto_reverted === true) {
        const activeCount = response.data.active_count || 0;
        alert(`Submit MO ${moNumber} gagal. Masih ada ${activeCount} input aktif dengan MO yang sama di session lain. Semua input yang sudah di-submit telah di-revert kembali ke aktif. Silakan submit ulang setelah semua input siap.`);
      } else {
        const updatedCount = response.data?.updated_count || inputsWithSameMo.length;
        alert(`Berhasil submit ${updatedCount} input untuk MO ${moNumber}`);
      }
      
      fetchData();
    } catch (error) {
      console.error('Error submitting MO:', error);
      if (error.response && error.response.data && error.response.data.error) {
        alert(`Error: ${error.response.data.error}`);
      } else {
      alert('Error memperbarui status');
      }
    }
  };

  const handleRevertMoGroup = async (moNumber) => {
    const userRole = localStorage.getItem('userRole') || 'production';
    const isAdmin = userRole === 'admin';
    
    if (!isAdmin) {
      alert('Hanya admin yang dapat melakukan revert MO');
      return;
    }
    
    if (!window.confirm(`Apakah Anda yakin ingin revert semua input untuk MO ${moNumber}? Status akan diubah dari completed kembali ke active.`)) {
      return;
    }
    
    try {
      const response = await axios.put(`/api/production/liquid/revert-mo-group/${moNumber}`, {
        userRole: userRole
      });
      
      if (response.data && response.data.reverted_count > 0) {
        alert(`Berhasil revert ${response.data.reverted_count} input untuk MO ${moNumber}`);
      } else {
        alert(response.data?.message || 'Tidak ada input yang dapat di-revert');
      }
      
      fetchData();
    } catch (error) {
      console.error('Error reverting MO group:', error);
      if (error.response && error.response.status === 403) {
        alert('Akses ditolak: Hanya admin yang dapat melakukan revert MO');
      } else {
        alert('Error melakukan revert MO');
      }
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

    // Validate authenticity data before submit
    const validation = validateAuthenticityData(allActiveInputs);
    if (!validation.valid) {
      alert(validation.message);
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
    setEditAuthenticityValidationStatus({});
  };

  const handleCancelEdit = () => {
    setEditingInput(null);
    setEditFormData(null);
    setEditingMoNumber(null);
    setEditingSessionId(null);
    setEditAuthenticityValidationStatus({});
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

    // Check if all non-empty rows are validated
    const rowsToValidate = editFormData.authenticityRows.filter((row, idx) => {
      const hasFirst = row.firstAuthenticity && row.firstAuthenticity.trim() !== '';
      const hasLast = row.lastAuthenticity && row.lastAuthenticity.trim() !== '';
      return hasFirst || hasLast;
    });

    if (rowsToValidate.length > 0) {
      // Check if roll number is filled for rows with authenticity data
      const rowsWithMissingRollNumber = rowsToValidate.filter((row, idx) => {
        return !row.rollNumber || row.rollNumber.trim() === '';
      });

      if (rowsWithMissingRollNumber.length > 0) {
        alert('Nomor roll tidak boleh kosong. Silakan isi nomor roll untuk semua row yang memiliki data authenticity.');
        return;
      }

      const allValidated = rowsToValidate.every((row, idx) => {
        const originalIndex = editFormData.authenticityRows.findIndex(r => r === row);
        return editAuthenticityValidationStatus[originalIndex] === true;
      });

      if (!allValidated) {
        alert('Silakan validate semua row authenticity yang sudah diisi sebelum save');
        return;
      }
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
      setEditAuthenticityValidationStatus({});
      fetchData();
    } catch (error) {
      console.error('Error updating data:', error);
      alert('Error memperbarui data');
    }
  };

  const handleEditRowChange = (index, field, value) => {
    const newRows = [...editFormData.authenticityRows];
    newRows[index][field] = value;
    
    // Auto-calculate Last Authenticity when First Authenticity is entered
    if (field === 'firstAuthenticity' && value.trim() !== '') {
      const firstNum = parseInt(value);
      if (!isNaN(firstNum) && (!newRows[index].lastAuthenticity || newRows[index].lastAuthenticity.trim() === '')) {
        // Calculate Last = First + rollNumber (if rollNumber exists and is valid), otherwise First + 1
        const rollNum = parseInt(newRows[index].rollNumber);
        const calculatedLast = rollNum && !isNaN(rollNum) && rollNum > 0 
          ? firstNum + rollNum 
          : firstNum + 1;
        newRows[index].lastAuthenticity = calculatedLast.toString();
      }
    }
    
    // Recalculate Last Authenticity when rollNumber changes (if First is set and Last is empty)
    if (field === 'rollNumber') {
      const firstValue = newRows[index].firstAuthenticity;
      if (firstValue && firstValue.trim() !== '') {
        const firstNum = parseInt(firstValue);
        if (!isNaN(firstNum) && (!newRows[index].lastAuthenticity || newRows[index].lastAuthenticity.trim() === '')) {
          const rollNum = parseInt(value);
          const calculatedLast = rollNum && !isNaN(rollNum) && rollNum > 0 
            ? firstNum + rollNum 
            : firstNum + 1;
          newRows[index].lastAuthenticity = calculatedLast.toString();
        }
      }
    }
    
    setEditFormData({
      ...editFormData,
      authenticityRows: newRows
    });
    
    // Reset validation status when field changes
    if (field === 'firstAuthenticity' || field === 'lastAuthenticity') {
      setEditAuthenticityValidationStatus(prev => ({
        ...prev,
        [index]: false
      }));
    }
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
      // Remove validation status for deleted row
      const newValidationStatus = { ...editAuthenticityValidationStatus };
      delete newValidationStatus[index];
      // Reindex remaining validations
      const reindexed = {};
      Object.keys(newValidationStatus).forEach(key => {
        const keyNum = parseInt(key);
        if (keyNum > index) {
          reindexed[keyNum - 1] = newValidationStatus[key];
        } else if (keyNum < index) {
          reindexed[keyNum] = newValidationStatus[key];
        }
      });
      setEditAuthenticityValidationStatus(reindexed);
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button onClick={handleStartManufacturing} className="start-button">
              Start Manufacturing Process
            </button>
            <small style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', lineHeight: '1.4' }}>
              Klik tombol ini untuk memulai proses manufacturing dan input data produksi
            </small>
          </div>
        ) : (
          <div>
            <div className="button-group">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <button onClick={handleInputAuthenticity} className="input-button">
                    Input Authenticity Label Process
                  </button>
                  <small style={{ color: '#666', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>
                    Input stiker holo berurutan (scan awal & akhir)
                  </small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <button onClick={handleInputBuffer} className="buffer-button">
                    Input Buffer Authenticity
                  </button>
                  <small style={{ color: '#666', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>
                    Input nomor authenticity diluar range
                  </small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <button onClick={handleInputReject} className="reject-button">
                    Input Reject Authenticity
                  </button>
                  <small style={{ color: '#666', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>
                    Input nomor authenticity yang reject
                  </small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  <button onClick={handleEndManufacturing} className="end-button">
                    End Manufacturing Process
                  </button>
                  <small style={{ color: '#666', fontSize: '11px', textAlign: 'center', lineHeight: '1.2' }}>
                    Akhiri proses manufacturing
                  </small>
                </div>
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
                        
                        // Check if user is admin
                        const userRole = localStorage.getItem('userRole') || 'production';
                        const isAdmin = userRole === 'admin';

                        return (
                          <div key={moNumber} className="mo-group-card">
                            <div className="mo-group-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong>MO Number:</strong> {moNumber}
                                <span className="mo-sku-badge">{inputs[0].sku_name}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                {isMoGroupCompleted && isAdmin && !isEditing ? (
                                  <button
                                    onClick={() => handleRevertMoGroup(moNumber)}
                                    className="revert-button"
                                    style={{ 
                                      padding: '4px 8px', 
                                      fontSize: '11px', 
                                      background: '#dc2626', 
                                      color: 'white', 
                                      border: 'none', 
                                      borderRadius: '4px', 
                                      cursor: 'pointer'
                                    }}
                                    title="Revert MO (Admin only)"
                                  >
                                    Revert
                                  </button>
                                ) : null}
                                <span className={`status-badge ${moGroupStatus}`}>
                                {moGroupStatus === 'completed' ? 'Completed' : 'Active'}
                              </span>
                              </div>
                            </div>
                            <div className="input-card">
                              <div className="input-card-header">
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  {(() => {
                                    if (activeInputs.length === 0 || isEditing) {
                                      return null;
                                    }
                                    
                                    // Check if all inputs for this MO in this session are active (no completed ones)
                                    const allInputsForMo = inputs.filter(input => input.mo_number === moNumber);
                                    const activeInputsForMo = allInputsForMo.filter(input => input.status === 'active');
                                    const canSubmit = activeInputsForMo.length === allInputsForMo.length && activeInputsForMo.length > 0;
                                    
                                    return (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                      <button
                                        onClick={() => handleSubmitMoGroup(moNumber, session.session_id)}
                                        className="submit-button"
                                          disabled={!canSubmit}
                                          style={{ 
                                            padding: '6px 12px', 
                                            fontSize: '12px', 
                                            background: canSubmit ? '#059669' : '#9ca3af', 
                                            color: 'white', 
                                            border: 'none', 
                                            borderRadius: '4px', 
                                            cursor: canSubmit ? 'pointer' : 'not-allowed',
                                            opacity: canSubmit ? 1 : 0.6
                                          }}
                                          title={!canSubmit ? 'Tidak dapat submit: masih ada input dengan status completed untuk MO ini' : ''}
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
                                    );
                                  })()}
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
                                        {editFormData.authenticityRows.map((row, rowIdx) => {
                                          const hasFirst = row.firstAuthenticity && row.firstAuthenticity.trim() !== '';
                                          const hasLast = row.lastAuthenticity && row.lastAuthenticity.trim() !== '';
                                          const isRowEmpty = !hasFirst && !hasLast;
                                          const isValidated = editAuthenticityValidationStatus[rowIdx] === true;
                                          
                                          return (
                                            <div key={rowIdx} className="authenticity-row-input">
                                              <input
                                                type="text"
                                                placeholder="First Authenticity"
                                                value={row.firstAuthenticity}
                                                onChange={(e) => handleEditRowChange(rowIdx, 'firstAuthenticity', e.target.value)}
                                                onBlur={() => handleAuthenticityBlur(rowIdx, true)}
                                                style={{ padding: '6px' }}
                                              />
                                              <input
                                                type="text"
                                                placeholder="Last Authenticity"
                                                value={row.lastAuthenticity}
                                                onChange={(e) => handleEditRowChange(rowIdx, 'lastAuthenticity', e.target.value)}
                                                onBlur={() => handleAuthenticityBlur(rowIdx, true)}
                                                style={{ padding: '6px' }}
                                              />
                                              <input
                                                type="text"
                                                placeholder="Roll Number"
                                                value={row.rollNumber}
                                                onChange={(e) => {
                                                  // Only allow numeric input
                                                  const value = e.target.value.replace(/[^0-9]/g, '');
                                                  handleEditRowChange(rowIdx, 'rollNumber', value);
                                                }}
                                                style={{ padding: '6px' }}
                                              />
                                              {isValidated ? (
                                                <div
                                                  className="validation-status-indicator"
                                                  style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    padding: '6px 12px',
                                                    background: '#10b981',
                                                    color: 'white',
                                                    borderRadius: '4px',
                                                    fontSize: '14px',
                                                    fontWeight: '500',
                                                    minWidth: '80px'
                                                  }}
                                                  title="Validated"
                                                >
                                                  ✓ Valid
                                                </div>
                                              ) : (
                                                <button
                                                  type="button"
                                                  onClick={() => !isRowEmpty && handleValidateRow(rowIdx, true)}
                                                  className={`validate-button ${isRowEmpty ? 'hidden' : ''}`}
                                                  style={{
                                                    background: '#3b82f6',
                                                    color: 'white'
                                                  }}
                                                  title="Validate row"
                                                  disabled={isRowEmpty}
                                                >
                                                  Validate
                                                </button>
                                              )}
                                              <button
                                                type="button"
                                                onClick={() => handleDeleteEditRow(rowIdx)}
                                                className={`delete-row-button ${editFormData.authenticityRows.length > 1 ? '' : 'hidden'}`}
                                              >
                                                ×
                                              </button>
                                            </div>
                                          );
                                        })}
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
                onChange={(e) => {
                  // Only allow numeric input
                  const value = e.target.value.replace(/[^0-9]/g, '');
                  setShiftNumber(value);
                }}
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
              <small style={{ color: '#666', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                Input PIC yang menjalankan input Manufacturing Order ini
              </small>
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
              <small style={{ color: '#666', fontSize: '13px', marginTop: '4px', display: 'block' }}>
                Input MO yang mau diinput
              </small>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <label style={{ margin: 0 }}>Authenticity Data</label>
                <span 
                  onClick={() => setShowHelpModal(true)}
                  title="Klik untuk melihat petunjuk pengisian"
                  style={{
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#3b82f6',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    userSelect: 'none'
                  }}
                >
                  ?
                </span>
              </div>
              {formData.authenticityRows.map((row, index) => {
                const hasFirst = row.firstAuthenticity && row.firstAuthenticity.trim() !== '';
                const hasLast = row.lastAuthenticity && row.lastAuthenticity.trim() !== '';
                const isRowEmpty = !hasFirst && !hasLast;
                const isValidated = authenticityValidationStatus[index] === true;
                const isInvalid = authenticityInvalidStatus[index];
                
                return (
                  <div key={index} className="authenticity-row-input">
                    <input
                      type="text"
                      placeholder="First Authenticity at"
                      value={row.firstAuthenticity}
                      onChange={(e) => handleRowChange(index, 'firstAuthenticity', e.target.value)}
                      onBlur={() => handleAuthenticityBlur(index, false)}
                      onKeyDown={(e) => handleScannerKeyDown(e, index, 'firstAuthenticity')}
                    />
                    <input
                      type="text"
                      placeholder="Last Authenticity at"
                      value={row.lastAuthenticity}
                      onChange={(e) => handleRowChange(index, 'lastAuthenticity', e.target.value)}
                      onBlur={() => handleAuthenticityBlur(index, false)}
                      onKeyDown={(e) => handleScannerKeyDown(e, index, 'lastAuthenticity')}
                    />
                    <input
                      type="text"
                      placeholder="Roll Number"
                      value={row.rollNumber}
                      onChange={(e) => {
                        // Only allow numeric input
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleRowChange(index, 'rollNumber', value);
                      }}
                      onKeyDown={(e) => handleScannerKeyDown(e, index, 'rollNumber')}
                    />
                    {isValidated ? (
                      <div
                        className="validation-status-indicator"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px 16px',
                          background: '#10b981',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '500',
                          minWidth: '100px'
                        }}
                        title="Validated"
                      >
                        ✓ Valid
                      </div>
                    ) : isInvalid ? (
                      <div
                        className="validation-status-indicator"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '8px 16px',
                          background: '#ef4444',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '500',
                          minWidth: '100px'
                        }}
                        title={isInvalid}
                      >
                        ✗ Invalid
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => !isRowEmpty && handleValidateRow(index, false)}
                        className={`validate-button ${isRowEmpty ? 'hidden' : ''}`}
                        style={{
                          background: '#3b82f6',
                          color: 'white'
                        }}
                        title="Validate row"
                        disabled={isRowEmpty}
                      >
                        Validate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(index)}
                      className={`delete-row-button ${formData.authenticityRows.length > 1 ? '' : 'hidden'}`}
                      title="Delete row"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
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
                    onBlur={() => handleBufferNumberBlur(index)}
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
                    onBlur={() => handleRejectNumberBlur(index)}
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
                    onBlur={() => handleEditBufferNumberBlur(index)}
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
                    onBlur={() => handleEditRejectNumberBlur(index)}
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

      {/* Button Help Modal */}
      {showButtonHelpModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowButtonHelpModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '700px',
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'white',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowButtonHelpModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#6b7280',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              ✕
            </button>

            <h2 style={{ 
              marginTop: 0,
              marginBottom: '24px', 
              color: '#1f2937',
              fontSize: '24px',
              fontWeight: '700',
              borderBottom: '3px solid #3b82f6',
              paddingBottom: '12px'
            }}>
              🎮 Petunjuk Penggunaan Button
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ 
                padding: '20px', 
                background: '#eff6ff', 
                borderLeft: '4px solid #3b82f6', 
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s'
              }}>
                <h3 style={{ 
                  color: '#1e40af', 
                  marginTop: 0, 
                  marginBottom: '10px', 
                  fontSize: '17px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>📝</span>
                  1. Input Authenticity Label Process
                </h3>
                <p style={{ margin: 0, color: '#1e3a8a', fontSize: '15px', lineHeight: '1.7' }}>
                  Digunakan untuk melakukan input stiker holo/authenticity yang konsumsinya <strong>berurutan</strong> dengan 
                  melakukan <strong>scan awal</strong> dan <strong>scan akhir</strong> dari proses tersebut.
                </p>
              </div>

              <div style={{ 
                padding: '20px', 
                background: '#fefce8', 
                borderLeft: '4px solid #eab308', 
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s'
              }}>
                <h3 style={{ 
                  color: '#a16207', 
                  marginTop: 0, 
                  marginBottom: '10px', 
                  fontSize: '17px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>📦</span>
                  2. Input Buffer Authenticity
                </h3>
                <p style={{ margin: 0, color: '#713f12', fontSize: '15px', lineHeight: '1.7' }}>
                  Digunakan untuk menginput nomor authenticity <strong>individual</strong> yang angka tersebut 
                  <strong> diluar dari range</strong> Input Authenticity Label Process.
                </p>
              </div>

              <div style={{ 
                padding: '20px', 
                background: '#fef2f2', 
                borderLeft: '4px solid #ef4444', 
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s'
              }}>
                <h3 style={{ 
                  color: '#b91c1c', 
                  marginTop: 0, 
                  marginBottom: '10px', 
                  fontSize: '17px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>❌</span>
                  3. Input Reject Authenticity
                </h3>
                <p style={{ margin: 0, color: '#7f1d1d', fontSize: '15px', lineHeight: '1.7' }}>
                  Digunakan untuk menginput nomor authenticity <strong>individual</strong> yang <strong>reject</strong>.
                </p>
              </div>

              <div style={{ 
                padding: '20px', 
                background: '#f0fdf4', 
                borderLeft: '4px solid #10b981', 
                borderRadius: '8px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                transition: 'transform 0.2s'
              }}>
                <h3 style={{ 
                  color: '#047857', 
                  marginTop: 0, 
                  marginBottom: '10px', 
                  fontSize: '17px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span style={{ fontSize: '20px' }}>✏️</span>
                  4. Tombol Edit
                </h3>
                <ul style={{ 
                  margin: 0, 
                  paddingLeft: '24px', 
                  color: '#065f46', 
                  fontSize: '15px', 
                  lineHeight: '1.7' 
                }}>
                  <li style={{ marginBottom: '10px' }}>
                    Tombol <strong>Edit</strong> digunakan untuk mengubah isi dari apa yang sudah kita input.
                  </li>
                  <li style={{ marginBottom: '0' }}>
                    Tombol <strong>Edit</strong> pada <strong>Input Authenticity Label Process</strong> hanya bisa dilakukan 
                    jika MO yang diinput <strong>belum disubmit</strong>.
                  </li>
                </ul>
              </div>
            </div>

            <div className="modal-buttons" style={{ marginTop: '24px' }}>
              <button 
                onClick={() => setShowButtonHelpModal(false)} 
                className="confirm-button"
                style={{ 
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
                }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div 
          className="modal-overlay" 
          onClick={() => setShowHelpModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            backdropFilter: 'blur(2px)'
          }}
        >
          <div 
            className="modal-content" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxWidth: '750px',
              width: '90%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'white',
              borderRadius: '12px',
              padding: '32px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              position: 'relative'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowHelpModal(false)}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: '#f3f4f6',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '20px',
                color: '#6b7280',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
                e.currentTarget.style.color = '#374151';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#6b7280';
              }}
            >
              ✕
            </button>

            <h2 style={{ 
              marginTop: 0,
              marginBottom: '24px', 
              color: '#1f2937',
              fontSize: '24px',
              fontWeight: '700',
              borderBottom: '3px solid #3b82f6',
              paddingBottom: '12px'
            }}>
              📋 Petunjuk Pengisian Form Authenticity
            </h2>
            
            {/* Case 1 */}
            <div style={{ 
              marginBottom: '28px',
              padding: '20px',
              background: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bfdbfe'
            }}>
              <h3 style={{ 
                color: '#1e40af', 
                marginTop: 0,
                marginBottom: '16px', 
                fontSize: '18px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '22px' }}>1️⃣</span>
                Case 1: Satu Roll dalam 1 MO
              </h3>
              <ol style={{ 
                paddingLeft: '28px', 
                lineHeight: '1.9', 
                color: '#1e3a8a',
                margin: 0
              }}>
                <li style={{ marginBottom: '12px' }}>
                  Lakukan input <strong>First Authenticity</strong> dengan melakukan scan pada packaging stiker holo (authenticity) 
                  <strong> pertama</strong> yang ditempel pada MO itu
                </li>
                <li style={{ marginBottom: '12px' }}>
                  Lakukan input <strong>Last Authenticity</strong> dengan melakukan scan pada packaging stiker holo (authenticity) 
                  <strong> terakhir</strong> yang ditempel pada saat MO itu dijalankan
                </li>
              </ol>
            </div>

            {/* Case 2 */}
            <div style={{ 
              marginBottom: '28px',
              padding: '20px',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              <h3 style={{ 
                color: '#15803d', 
                marginTop: 0,
                marginBottom: '16px', 
                fontSize: '18px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ fontSize: '22px' }}>2️⃣</span>
                Case 2: Lebih dari 1 Roll untuk 1 MO
              </h3>
              <ol style={{ 
                paddingLeft: '28px', 
                lineHeight: '1.9', 
                color: '#166534',
                margin: 0
              }}>
                <li style={{ marginBottom: '12px' }}>
                  Lakukan input <strong>First Authenticity</strong> dengan melakukan scan pada packaging stiker holo (authenticity) 
                  <strong> pertama</strong> yang ditempel pada MO itu
                </li>
                <li style={{ marginBottom: '12px' }}>
                  Lakukan input <strong>Last Authenticity</strong> dengan melakukan scan pada packaging stiker holo (authenticity) 
                  yang ditempel pada <strong>roll yang terakhir digunakan</strong> di roll pertama
                </li>
                <li style={{ marginBottom: '12px' }}>
                  Klik tombol <strong>"+ Add Row"</strong> untuk menambah baris baru
                </li>
                <li style={{ marginBottom: '12px' }}>
                  Lakukan input <strong>First Authenticity</strong> dengan melakukan scan pada packaging stiker holo (authenticity) 
                  <strong> pertama</strong> di roll baru yang ditempel pada MO itu
                </li>
                <li style={{ marginBottom: '12px' }}>
                  Lakukan input <strong>Last Authenticity</strong> dengan melakukan scan pada packaging stiker holo (authenticity) 
                  <strong> terakhir</strong> di roll baru yang ditempel pada MO itu (jika roll ini terakhir digunakan)
                </li>
                <li style={{ marginBottom: '12px' }}>
                  <strong>Ikuti langkah 3, 4, dan 5</strong> jika ada penambahan roll lagi
                </li>
              </ol>
            </div>

            {/* Important Note */}
            <div style={{ 
              padding: '16px 20px', 
              background: '#fffbeb', 
              borderLeft: '4px solid #f59e0b', 
              borderRadius: '6px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
            }}>
              <p style={{ 
                margin: 0, 
                color: '#92400e', 
                fontSize: '15px',
                lineHeight: '1.6'
              }}>
                <strong style={{ fontSize: '16px' }}>⚠️ Catatan Penting:</strong><br/>
                Pastikan untuk klik tombol <strong>"Validate"</strong> pada setiap baris yang sudah diisi 
                sebelum melakukan <strong>"Confirm Input"</strong>
              </p>
            </div>

            <div className="modal-buttons" style={{ marginTop: '24px' }}>
              <button 
                onClick={() => setShowHelpModal(false)} 
                className="confirm-button"
                style={{ 
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 6px 12px rgba(59, 130, 246, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 4px 6px rgba(59, 130, 246, 0.3)';
                }}
              >
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Help Button */}
      <div 
        onClick={() => setShowButtonHelpModal(true)}
        title="Klik untuk melihat petunjuk penggunaan"
        style={{
          position: 'fixed',
          bottom: '20px',
          left: '20px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#3b82f6',
          color: 'white',
          fontSize: '28px',
          fontWeight: 'bold',
          userSelect: 'none',
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(59, 130, 246, 0.5)',
          transition: 'all 0.3s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.5)';
        }}
      >
        ?
      </div>
    </div>
  );
}

export default ProductionLiquid;


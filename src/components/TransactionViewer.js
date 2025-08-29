import React, { useState, useEffect, forwardRef, useImperativeHandle, useMemo } from 'react';
import axios from 'axios';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
  TableContainer,
  TablePagination,
  Chip,
  Button,
  CircularProgress,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  IconButton,
  Tooltip,
  Snackbar,
} from '@mui/material';
import { CalendarToday, Download, FilePresent, Refresh, Summarize, GetApp } from '@mui/icons-material';

const API_BASE_URL = 'http://localhost:8000';
const ITEMS_PER_PAGE = 10;

// Memoized Transactions Table
const TransactionsTable = React.memo(({ transactions }) => (
  <TableContainer>
    <Table stickyHeader>
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Description</TableCell>
          <TableCell align="right">Amount</TableCell>
          <TableCell>Type</TableCell>
          <TableCell align="right">Balance</TableCell>
          <TableCell>Source</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {transactions.map((txn, index) => (
          <TableRow key={txn.id || index} hover>
            <TableCell>{txn.date}</TableCell>
            <TableCell sx={{ maxWidth: 200 }}>
              <Tooltip title={txn.description || ''}>
                <Typography noWrap variant="body2">{txn.description}</Typography>
              </Tooltip>
            </TableCell>
            <TableCell align="right" sx={{ color: txn.amount >= 0 ? 'success.main' : 'error.main' }}>
              BWP {Math.abs(txn.amount).toLocaleString()}
            </TableCell>
            <TableCell>
              <Chip
                label={txn.is_payment ? 'Payment' : 'Disbursement'}
                color={txn.is_payment ? 'success' : 'error'}
                size="small"
                variant="outlined"
              />
            </TableCell>
            <TableCell align="right">BWP {txn.balance?.toLocaleString()}</TableCell>
            <TableCell>
              <Typography variant="caption" color="textSecondary">{txn.source}</Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
));

const TransactionViewer = forwardRef((props, ref) => {
  const [uploadDates, setUploadDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [downloadingType, setDownloadingType] = useState(null);
  const [batchSummary, setBatchSummary] = useState(null);
  const [page, setPage] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch upload dates
  const fetchUploadDates = async () => {
    try {
      setError(null);
      const response = await axios.get(`${API_BASE_URL}/upload-dates/`);
      const dates = response.data;
      setUploadDates(dates);
      if (dates.length && !selectedDate) setSelectedDate(dates[0]);
    } catch (err) {
      console.error('Error fetching upload dates:', err);
      setError('Failed to load upload dates');
    }
  };

  // Fetch transactions
  const fetchTransactions = async (date, pageNumber = 0) => {
    if (!date) return;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    try {
      const skip = pageNumber * ITEMS_PER_PAGE;
      const response = await axios.get(
        `${API_BASE_URL}/transactions/?upload_date=${date}&skip=${skip}&limit=${ITEMS_PER_PAGE}`,
        { signal: controller.signal }
      );
      setTransactions(response.data);

      // Total count
      const allResponse = await axios.get(`${API_BASE_URL}/transactions/?upload_date=${date}`, {
        signal: controller.signal,
      });
      setTotalTransactions(allResponse.data.length);

      // Fetch batch summary
      await fetchBatchSummary(date, controller.signal);
    } catch (err) {
      if (axios.isCancel(err)) {
        console.log('Request cancelled:', err.message);
      } else {
        console.error('Error fetching transactions:', err);
        setError('Failed to load transactions');
      }
    } finally {
      setLoading(false);
    }
    return () => controller.abort();
  };

  // Fetch batch summary
  const fetchBatchSummary = async (date, signal) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports/daily-summary/`, { signal });
      const summary = response.data.find(item => item.date === date);
      setBatchSummary(summary);
    } catch (err) {
      if (!axios.isCancel(err)) console.error('Error fetching batch summary:', err);
    }
  };

  // Download report
  const downloadReport = async (type, format) => {
    if (!selectedDate) {
      setError('Please select a date before downloading');
      return;
    }
    const downloadKey = `${type}_${format}`;
    setDownloadingType(downloadKey);
    setError(null);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/download/${type}/${format}?upload_date=${selectedDate}`,
        { responseType: 'blob', timeout: 30000 }
      );
      if (response.data.size === 0) throw new Error('No data returned from server');

      const blob = new Blob([response.data], {
        type: format === 'excel'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      const extension = format === 'excel' ? 'xlsx' : 'pdf';
      link.setAttribute('download', `${type}_report_${selectedDate}_${timestamp}.${extension}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMessage(`${type} ${format} report downloaded successfully`);
    } catch (err) {
      console.error('Download failed:', err);
      if (err.code === 'ECONNABORTED') setError('Download timed out. Please try again.');
      else if (err.response?.status === 404) setError(`No ${type} data found for the selected date.`);
      else if (err.response?.status === 500) setError('Server error occurred. Please try again.');
      else setError(`Download failed: ${err.message || 'Unknown error occurred'}`);
    } finally {
      setDownloadingType(null);
    }
  };

  // Download combined report
  const downloadCombinedReport = async () => {
    if (!selectedDate) {
      setError('Please select a date before downloading');
      return;
    }
    setDownloadingType('combined_excel');
    setError(null);
    try {
      const response = await axios.get(
        `${API_BASE_URL}/download/combined/excel?upload_date=${selectedDate}`,
        { responseType: 'blob', timeout: 30000 }
      );
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const timestamp = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `combined_report_${selectedDate}_${timestamp}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setSuccessMessage('Combined report downloaded successfully');
    } catch (err) {
      console.error('Combined download failed:', err);
      setError(`Combined report download failed: ${err.message || 'Unknown error occurred'}`);
    } finally {
      setDownloadingType(null);
    }
  };

  // Handlers
  const handleDateChange = (event) => {
    const newDate = event.target.value;
    setSelectedDate(newDate);
    setPage(0);
    fetchTransactions(newDate, 0);
  };
  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    fetchTransactions(selectedDate, newPage);
  };
  const handleRefresh = () => {
    fetchUploadDates();
    if (selectedDate) fetchTransactions(selectedDate, page);
  };

  useImperativeHandle(ref, () => ({ refresh: handleRefresh }));

  // Effects
  useEffect(() => { fetchUploadDates(); }, []);
  useEffect(() => {
    if (selectedDate) {
      fetchTransactions(selectedDate, page);
    }
    // ✅ include page in deps
  }, [selectedDate, page]);

  // Memoized Download Buttons
  const downloadButtons = useMemo(() => (
    <Box mb={3} display="flex" gap={1} flexWrap="wrap">
      <Button
        variant="contained"
        startIcon={downloadingType === 'payments_excel' ? <CircularProgress size={16} /> : <Download />}
        onClick={() => downloadReport('payments', 'excel')}
        disabled={!!downloadingType}
        size="small"
      >
        {downloadingType === 'payments_excel' ? 'Downloading...' : 'Payments Excel'}
      </Button>
      <Button
        variant="contained"
        startIcon={downloadingType === 'disbursements_excel' ? <CircularProgress size={16} /> : <Download />}
        onClick={() => downloadReport('disbursements', 'excel')}
        disabled={!!downloadingType}
        size="small"
        color="secondary"
      >
        {downloadingType === 'disbursements_excel' ? 'Downloading...' : 'Disbursements Excel'}
      </Button>
      <Button
        variant="outlined"
        startIcon={downloadingType === 'payments_pdf' ? <CircularProgress size={16} /> : <FilePresent />}
        onClick={() => downloadReport('payments', 'pdf')}
        disabled={!!downloadingType}
        size="small"
      >
        {downloadingType === 'payments_pdf' ? 'Downloading...' : 'Payments PDF'}
      </Button>
      <Button
        variant="outlined"
        startIcon={downloadingType === 'disbursements_pdf' ? <CircularProgress size={16} /> : <FilePresent />}
        onClick={() => downloadReport('disbursements', 'pdf')}
        disabled={!!downloadingType}
        size="small"
        color="secondary"
      >
        {downloadingType === 'disbursements_pdf' ? 'Downloading...' : 'Disbursements PDF'}
      </Button>
      <Button
        variant="outlined"
        startIcon={downloadingType === 'combined_excel' ? <CircularProgress size={16} /> : <GetApp />}
        onClick={downloadCombinedReport}
        disabled={!!downloadingType}
        size="small"
        color="info"
      >
        {downloadingType === 'combined_excel' ? 'Downloading...' : 'Combined Report'}
      </Button>
    </Box>
  ), [downloadingType, selectedDate]);

  return (
    <Paper sx={{ p: 3, minHeight: 500 }}>
      <Snackbar open={!!successMessage} autoHideDuration={6000} onClose={() => setSuccessMessage('')} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setSuccessMessage('')} severity="success">{successMessage}</Alert>
      </Snackbar>

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
        <Box display="flex" alignItems="center" gap={1}>
          <CalendarToday color="primary" />
          <Typography variant="h6">Transactions by Upload Date</Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Upload Date</InputLabel>
            <Select value={selectedDate} onChange={handleDateChange} label="Upload Date">
              {uploadDates.map(date => <MenuItem key={date} value={date}>{new Date(date).toLocaleDateString()}</MenuItem>)}
            </Select>
          </FormControl>
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} color="primary"><Refresh /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {batchSummary && selectedDate && (
        <Grid container spacing={2} mb={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
              <Summarize fontSize="small" />
              <Typography variant="subtitle2">Payments</Typography>
              <Typography variant="h6">{batchSummary.payment_count}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.main', color: 'white' }}>
              <Typography variant="subtitle2">Total Payments</Typography>
              <Typography variant="h6">BWP {batchSummary.total_payments?.toLocaleString()}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'error.main', color: 'white' }}>
              <Typography variant="subtitle2">Total Disbursements</Typography>
              <Typography variant="h6">BWP {batchSummary.total_disbursements?.toLocaleString()}</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Paper sx={{
              p: 2,
              textAlign: 'center',
              bgcolor: batchSummary.net_flow >= 0 ? 'success.main' : 'error.main',
              color: 'white'
            }}>
              <Typography variant="subtitle2">Net Flow</Typography>
              <Typography variant="h6">BWP {batchSummary.net_flow?.toLocaleString()}</Typography>
            </Paper>
          </Grid>
        </Grid>
      )}

      {selectedDate && downloadButtons}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <CircularProgress />
          <Typography variant="body2" mt={2}>Loading transactions...</Typography>
        </Box>
      ) : transactions.length > 0 ? (
        <>
          <TransactionsTable transactions={transactions} />
          <TablePagination
            component="div"
            count={totalTransactions}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={ITEMS_PER_PAGE}
            rowsPerPageOptions={[ITEMS_PER_PAGE]}
            sx={{ borderTop: '1px solid', borderColor: 'divider' }}
          />
        </>
      ) : selectedDate ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <Typography variant="body2" color="textSecondary">No transactions found for selected date</Typography>
        </Box>
      ) : (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <Typography variant="body2" color="textSecondary">Please select an upload date to view transactions</Typography>
        </Box>
      )}
    </Paper>
  );
});

TransactionViewer.displayName = 'TransactionViewer';
export default TransactionViewer;

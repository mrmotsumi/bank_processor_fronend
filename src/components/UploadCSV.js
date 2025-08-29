import React, { useState } from 'react';
import { 
  Box, 
  Button, 
  Typography, 
  Paper, 
  LinearProgress, 
  Alert,
  AlertTitle,
  Snackbar,
  Chip,
  Divider
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000';

const UploadCSV = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const validateFile = (file) => {
    const errors = [];
    
    // Check file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      errors.push('File must be a CSV file');
    }
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
      errors.push('File size must be less than 10MB');
    }
    
    // Check if file is empty
    if (file.size === 0) {
      errors.push('File appears to be empty');
    }
    
    return errors;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validationErrors = validateFile(file);
      if (validationErrors.length > 0) {
        setError(validationErrors.join(', '));
        setSelectedFile(null);
      } else {
        setSelectedFile(file);
        setError('');
        setUploadResult(null);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      setUploading(true);
      setError('');
      setUploadResult(null);

      console.log('Uploading file:', selectedFile.name);
      console.log('File size:', selectedFile.size);
      console.log('API URL:', `${API_BASE_URL}/upload-csv/`);

      const response = await axios.post(`${API_BASE_URL}/upload-csv/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 second timeout
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          console.log('Upload progress:', percentCompleted + '%');
        },
      });

      console.log('Upload response:', response.data);
      
      setUploadResult(response.data);
      setSelectedFile(null);
      setShowSuccess(true);
      
      if (onUploadSuccess) {
        onUploadSuccess(response.data);
      }
      
    } catch (err) {
      console.error('Upload error details:', err);
      
      let errorMessage = 'Upload failed. ';
      
      if (err.code === 'ECONNABORTED') {
        errorMessage += 'Request timed out. Please try again.';
      } else if (err.response) {
        // Server responded with error status
        console.error('Server error response:', err.response.data);
        console.error('Status code:', err.response.status);
        
        switch (err.response.status) {
          case 400:
            errorMessage += err.response.data?.detail || 'Invalid file format or content.';
            break;
          case 413:
            errorMessage += 'File is too large.';
            break;
          case 500:
            errorMessage += err.response.data?.detail || 'Server error occurred.';
            break;
          default:
            errorMessage += `Server error (${err.response.status}): ${err.response.data?.detail || 'Unknown error'}`;
        }
      } else if (err.request) {
        // Network error
        console.error('Network error:', err.request);
        errorMessage += 'Network error. Please check if the server is running and accessible.';
      } else {
        // Other error
        errorMessage += err.message || 'Unknown error occurred.';
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setError('');
    setUploadResult(null);
    // Reset the file input
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <>
      {/* Success Snackbar */}
      <Snackbar 
        open={showSuccess} 
        autoHideDuration={6000} 
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={() => setShowSuccess(false)} severity="success">
          <AlertTitle>Upload Successful!</AlertTitle>
          CSV file has been processed successfully.
        </Alert>
      </Snackbar>

      <Paper sx={{ p: 4, maxWidth: 700, mx: 'auto' }}>
        <Box textAlign="center" mb={3}>
          <UploadFileIcon sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Upload CSV File
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Upload your bank transaction CSV file for processing
          </Typography>
        </Box>

        {/* File Selection */}
        <Box mb={3}>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            style={{ 
              display: 'block', 
              margin: '20px auto',
              padding: '10px',
              border: '2px dashed #ccc',
              borderRadius: '4px',
              width: '100%',
              maxWidth: '400px'
            }}
            disabled={uploading}
          />
          
          {selectedFile && (
            <Box mt={2} p={2} bgcolor="grey.100" borderRadius={1}>
              <Typography variant="body1" gutterBottom>
                <strong>Selected file:</strong> {selectedFile.name}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Size: {(selectedFile.size / 1024).toFixed(2)} KB
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Type: {selectedFile.type || 'text/csv'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            <AlertTitle>Upload Error</AlertTitle>
            {error}
          </Alert>
        )}

        {/* Upload Result */}
        {uploadResult && (
          <Box mb={3}>
            <Alert severity="success" sx={{ mb: 2 }}>
              <AlertTitle>Upload Completed</AlertTitle>
              {uploadResult.message}
            </Alert>
            
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="h6" gutterBottom>
                Processing Results
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                <Chip 
                  icon={<CheckCircleIcon />}
                  label={`${uploadResult.processed_transactions} Processed`}
                  color="success"
                  variant="outlined"
                />
                {uploadResult.duplicate_transactions > 0 && (
                  <Chip 
                    icon={<WarningIcon />}
                    label={`${uploadResult.duplicate_transactions} Duplicates Skipped`}
                    color="warning"
                    variant="outlined"
                  />
                )}
                {uploadResult.total_errors > 0 && (
                  <Chip 
                    icon={<ErrorIcon />}
                    label={`${uploadResult.total_errors} Errors`}
                    color="error"
                    variant="outlined"
                  />
                )}
              </Box>
              
              <Typography variant="body2" gutterBottom>
                <strong>Upload Date:</strong> {uploadResult.upload_date}
              </Typography>
              
              {uploadResult.errors && uploadResult.errors.length > 0 && (
                <Box mt={2}>
                  <Typography variant="subtitle2" color="error">
                    Errors encountered:
                  </Typography>
                  <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                    {uploadResult.errors.slice(0, 5).map((error, index) => (
                      <Typography component="li" key={index} variant="body2" color="error">
                        {error}
                      </Typography>
                    ))}
                    {uploadResult.errors.length > 5 && (
                      <Typography variant="body2" color="textSecondary">
                        ... and {uploadResult.errors.length - 5} more errors
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Paper>
          </Box>
        )}

        {/* Action Buttons */}
        <Box display="flex" justifyContent="center" gap={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            size="large"
          >
            {uploading ? 'Uploading...' : 'Upload File'}
          </Button>
          
          {(selectedFile || uploadResult) && (
            <Button
              variant="outlined"
              onClick={resetUpload}
              disabled={uploading}
              size="large"
            >
              Clear
            </Button>
          )}
        </Box>

        {/* Progress Bar */}
        {uploading && (
          <Box mt={2}>
            <LinearProgress />
            <Typography variant="body2" color="textSecondary" textAlign="center" mt={1}>
              Processing file... This may take a few moments.
            </Typography>
          </Box>
        )}

        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <Box mt={3} p={2} bgcolor="grey.100" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom>
              Debug Information:
            </Typography>
            <Typography variant="body2">
              API URL: {API_BASE_URL}/upload-csv/
            </Typography>
            <Typography variant="body2">
              Environment: {process.env.NODE_ENV}
            </Typography>
          </Box>
        )}
      </Paper>
    </>
  );
};

export default UploadCSV;
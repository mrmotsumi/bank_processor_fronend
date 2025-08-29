import React, { useState } from 'react';
import TransactionViewer from './components/TransactionViewer';
import UploadCSV from './components/UploadCSV';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { Box, Container, Typography, Tabs, Tab } from '@mui/material';

function App() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box textAlign="center" mb={4}>
        <Typography variant="h3" gutterBottom>
          Bank Transaction Processor
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Upload and analyze your bank transaction CSV files
        </Typography>
      </Box>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        indicatorColor="primary"
        textColor="primary"
        centered
        sx={{ mb: 4 }}
      >
        <Tab icon={<UploadFileIcon />} label="Upload CSV" />
        <Tab icon={<CalendarTodayIcon />} label="View Transactions" />
      </Tabs>

      {activeTab === 0 ? <UploadCSV /> : <TransactionViewer />}
    </Container>
  );
}

export default App;

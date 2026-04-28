import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DriverApp from './pages/DriverApp';
import MonitorPanel from './pages/MonitorPanel';
import ManagerDashboard from './pages/ManagerDashboard';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/driver/*" element={<DriverApp />} />
        <Route path="/monitor/*" element={<MonitorPanel />} />
        <Route path="/dashboard/*" element={<ManagerDashboard />} />
        <Route path="/admin/*" element={<AdminPanel />} />
      </Routes>
    </Router>
  );
}

export default App;

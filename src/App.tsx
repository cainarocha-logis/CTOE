import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import DriverApp from './pages/DriverApp';
import MonitorPanel from './pages/MonitorPanel';
import ManagerDashboard from './pages/ManagerDashboard';
import Login from './pages/Login';
import AdminPanel from './pages/AdminPanel';
import WarehouseApp from './pages/WarehouseApp';
import GateApp from './pages/GateApp';

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
        <Route path="/armazem/*" element={<WarehouseApp />} />
        <Route path="/portaria/*" element={<GateApp />} />
      </Routes>
    </Router>
  );
}

export default App;

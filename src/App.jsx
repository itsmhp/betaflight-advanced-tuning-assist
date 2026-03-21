import { Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ErrorBoundary from './components/ErrorBoundary';
import AntiGravityPage from './pages/AntiGravityPage';
import StickAnalyzerPage from './pages/StickAnalyzerPage';
import PIDMultiplierPage from './pages/PIDMultiplierPage';
import PIDContributionPage from './pages/PIDContributionPage';
import FilterAnalyzerPage from './pages/FilterAnalyzerPage';
import ThrustLinearPage from './pages/ThrustLinearPage';
import FeedforwardPage from './pages/FeedforwardPage';
import TPAPage from './pages/TPAPage';
import ITermPage from './pages/ITermPage';
import ThrottleAxisPage from './pages/ThrottleAxisPage';
import PropWashPage from './pages/PropWashPage';
import AdvancedPIDPage from './pages/AdvancedPIDPage';
import MotorDoctorPage from './pages/MotorDoctorPage';
import NoiseProfilePage from './pages/NoiseProfilePage';
import DynamicIdlePage from './pages/DynamicIdlePage';
import PresetsPage from './pages/PresetsPage';
import DroneProfilePage from './pages/DroneProfilePage';
import SerialCLIPage from './pages/SerialCLIPage';
import TuneWorkflowPage from './pages/TuneWorkflowPage';
import LogComparisonPage from './pages/LogComparisonPage';
import RatesPage from './pages/RatesPage';
import FreestyleAnalysisPage from './pages/FreestyleAnalysisPage';

function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/advanced-pid" element={<AdvancedPIDPage />} />
            <Route path="/motor-doctor" element={<MotorDoctorPage />} />
            <Route path="/throttle-axis" element={<ThrottleAxisPage />} />
            <Route path="/noise-profile" element={<NoiseProfilePage />} />
            <Route path="/tpa" element={<TPAPage />} />
            <Route path="/prop-wash" element={<PropWashPage />} />
            <Route path="/anti-gravity" element={<AntiGravityPage />} />
            <Route path="/iterm" element={<ITermPage />} />
            <Route path="/feedforward" element={<FeedforwardPage />} />
            <Route path="/filter-analyzer" element={<FilterAnalyzerPage />} />
            <Route path="/pid-multiplier" element={<PIDMultiplierPage />} />
            <Route path="/thrust-linear" element={<ThrustLinearPage />} />
            <Route path="/pid-contribution" element={<PIDContributionPage />} />
            <Route path="/stick-analyzer" element={<StickAnalyzerPage />} />
            <Route path="/dynamic-idle" element={<DynamicIdlePage />} />
            <Route path="/freestyle" element={<FreestyleAnalysisPage />} />
            <Route path="/presets" element={<PresetsPage />} />
            <Route path="/rates" element={<RatesPage />} />
            <Route path="/my-drone" element={<DroneProfilePage />} />
            <Route path="/serial" element={<SerialCLIPage />} />
            <Route path="/tune" element={<TuneWorkflowPage />} />
            <Route path="/compare-logs" element={<LogComparisonPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  );
}

export default App;

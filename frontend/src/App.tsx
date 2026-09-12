/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MissionProvider } from './state/MissionContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { MissionPage } from './pages/MissionPage';
import { DetectionPage } from './pages/DetectionPage';
import { QueuePage } from './pages/QueuePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export default function App() {
  return (
    <MissionProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-black text-white flex flex-col selection:bg-white selection:text-black">
          {/* Persistent Technical Header */}
          <Header />

          {/* Operational Main Content Workspace */}
          <main className="flex-1 w-full flex flex-col">
            <Routes>
              <Route path="/" element={<Navigate to="/mission" replace />} />
              <Route path="/mission" element={<MissionPage />} />
              <Route path="/detection" element={<DetectionPage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/mission" replace />} />
            </Routes>
          </main>

          {/* Persistent Minimal Operational Footer */}
          <Footer />
        </div>
      </BrowserRouter>
    </MissionProvider>
  );
}


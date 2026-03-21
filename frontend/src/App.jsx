import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import NotesViewer from './pages/NotesViewer';
import Progress from './pages/Progress';
import SharedViewer from './pages/SharedViewer';
import Layout from './components/Layout';
import GlobalSearch from './components/GlobalSearch';
import KeyboardShortcuts from './components/KeyboardShortcuts';
import { GamificationProvider } from './context/GamificationContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 5 * 60 * 1000 },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <GamificationProvider>
          <BrowserRouter>
            <GlobalSearch />
            <KeyboardShortcuts />
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/shared/:syllabusId" element={<SharedViewer />} />
              <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/upload" element={<Upload />} />
                <Route path="/notes/:syllabusId" element={<NotesViewer />} />
                <Route path="/progress/:syllabusId" element={<Progress />} />
              </Route>
            </Routes>
            <Toaster
              position="top-right"
              toastOptions={{
                style: {
                  background: '#18181f',
                  color: '#e2e8f0',
                  border: '1px solid rgba(255,255,255,0.08)',
                },
              }}
            />
          </BrowserRouter>
          </GamificationProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

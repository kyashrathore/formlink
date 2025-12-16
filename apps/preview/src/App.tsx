import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LandingPage from "./components/LandingPage";
import MarketingAgencyLeadIntake from "./components/wtIaZZ0Z2j";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/f/wtIaZZ0Z2j" element={<MarketingAgencyLeadIntake />} />
      </Routes>
    </Router>
  );
}

import { BrowserRouter, Routes, Route } from "react-router-dom";
import CasesPage from "./components/CasesPage";
import JewelryCollection from "./components/JewelryCollection";
import { Analytics } from "@vercel/analytics/react";
 
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CasesPage />} />
        <Route path="/devir" element={<JewelryCollection />} />
      </Routes>
            <Analytics />
    </BrowserRouter>
  );
}
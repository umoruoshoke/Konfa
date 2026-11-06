import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-brand-navy flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-brand-navy tracking-tight">
            AuthentiChain
          </span>
        </Link>

        {/* Nav links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
          <Link to="/" className="hover:text-brand-teal transition">Home</Link>
          <Link to="/about" className="hover:text-brand-teal transition">About Us</Link>
          <Link to="/manufacturers" className="hover:text-brand-teal transition">For Manufacturers</Link>
          <Link to="/contact" className="hover:text-brand-teal transition">Contact</Link>
        </nav>

        {/* CTA */}
        <Link
          to="/verify"
          className="bg-brand-teal hover:bg-brand-tealDark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition shadow-sm"
        >
          Verify a Product
        </Link>
      </div>
    </header>
  );
}
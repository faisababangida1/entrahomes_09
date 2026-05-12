import React from 'react';
import { Home, Mail, ShieldCheck } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-2xl font-outfit font-bold tracking-tight text-primary-900">
              <div className="bg-primary-600 p-1.5 rounded-xl">
                <Home className="h-6 w-6 text-white" />
              </div>
              <span>EntraHomes</span>
            </div>
            <p className="text-gray-500 font-medium leading-relaxed max-w-xs">
              Smart housing for professionals. Zero inspection fees.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Contact Us</h4>
            <div className="space-y-4">
              <a href="mailto:info@entrahome.site" className="flex items-center gap-3 text-gray-600 hover:text-primary-600 transition-colors font-medium">
                <div className="h-10 w-10 rounded-xl bg-gray-50 flex items-center justify-center">
                  <Mail className="h-5 w-5" />
                </div>
                info@entrahome.site
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-6">Trust & Safety</h4>
            <div className="flex items-center gap-3 text-gray-600 font-medium">
              <div className="h-10 w-10 rounded-xl bg-accent-50 flex items-center justify-center">
                <ShieldCheck className="h-5 w-5 text-accent-600" />
              </div>
              Verified Landlords Only
            </div>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-400 text-sm font-medium">
            © 2026 EntraHomes. All rights reserved.
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">Privacy Policy</a>
            <a href="#" className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

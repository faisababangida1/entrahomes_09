import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';

interface TrustBadgeProps {
  score?: number;
  isVerified?: boolean;
  className?: string;
}

export default function TrustBadge({ score = 50, isVerified = false, className = '' }: TrustBadgeProps) {
  let level = 'Neutral';
  let colorClass = 'bg-gray-100 text-gray-700 border-gray-200';
  let Icon = ShieldQuestion;

  if (score >= 80) {
    level = 'Highly Trusted';
    colorClass = 'bg-accent-50 text-accent-700 border-accent-200';
    Icon = ShieldCheck;
  } else if (score >= 60) {
    level = 'Good Standing';
    colorClass = 'bg-primary-50 text-primary-700 border-primary-200';
    Icon = Shield;
  } else if (score < 40) {
    level = 'Needs Attention';
    colorClass = 'bg-red-50 text-red-700 border-red-200';
    Icon = ShieldAlert;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${colorClass}`}>
        <Icon className="h-4 w-4" />
        <span>{level}</span>
      </div>
      {isVerified && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100">
          <ShieldCheck className="h-4 w-4" />
          <span>ID Verified</span>
        </div>
      )}
    </div>
  );
}

interface ScoreCircleProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const getScoreColor = (score: number): string => {
  if (score >= 83) return 'text-score-excellent';   // Excellent
  if (score >= 76) return 'text-score-good';         // Great
  if (score >= 56) return 'text-score-fair';         // Good
  if (score >= 46) return 'text-warning';            // Fair
  if (score >= 21) return 'text-danger';             // Bad
  return 'text-[#8B0000]';                           // Very Bad — deep red
};

const getScoreLabel = (score: number): string => {
  if (score >= 83) return 'Excellent';
  if (score >= 76) return 'Great';
  if (score >= 56) return 'Good';
  if (score >= 46) return 'Fair';
  if (score >= 21) return 'Bad';
  return 'Very Bad';
};

const getScoreStrokeColor = (score: number): string => {
  if (score >= 83) return 'stroke-score-excellent';  // Excellent
  if (score >= 76) return 'stroke-score-good';       // Great
  if (score >= 56) return 'stroke-score-fair';       // Good
  if (score >= 46) return 'stroke-warning';          // Fair
  if (score >= 21) return 'stroke-danger';           // Bad
  return 'stroke-[#8B0000]';                         // Very Bad
};

const sizeMap = {
  sm: { wrapper: 'w-16 h-16', text: 'text-lg', label: 'text-xs', stroke: 4 },
  md: { wrapper: 'w-24 h-24', text: 'text-2xl', label: 'text-sm', stroke: 6 },
  lg: { wrapper: 'w-32 h-32', text: 'text-4xl', label: 'text-base', stroke: 8 },
};

const ScoreCircle = ({ score, size = 'md', showLabel = true }: ScoreCircleProps) => {
  const { wrapper, text, label, stroke } = sizeMap[size];
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${wrapper}`}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            className="text-muted"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            className={`${getScoreStrokeColor(score)} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`font-display font-bold ${text} ${getScoreColor(score)}`}>
            {score}
          </span>
        </div>
      </div>
      {showLabel && (
        <div className="text-center">
          <p className={`text-muted-foreground ${label}`}>Online Score</p>
          <p className={`font-semibold ${getScoreColor(score)} ${label}`}>
            {getScoreLabel(score)}
          </p>
        </div>
      )}
    </div>
  );
};

export default ScoreCircle;

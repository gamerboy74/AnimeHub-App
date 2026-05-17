import React from 'react';
import { View, Text } from 'react-native';
import { LucideIcon } from 'lucide-react-native';


interface StatChipProps {
  label: string;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'surface';
  className?: string;
}

export const StatChip: React.FC<StatChipProps> = ({ 
  label, 
  icon: Icon,
  variant = 'surface',
  className = ''
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary/10 border-primary/20 text-primary';
      case 'secondary':
        return 'bg-secondary/10 border-secondary/20 text-secondary';
      case 'surface':
        return 'bg-surface-container-highest/60 border-outline-variant/30 text-on-surface';
      default:
        return 'bg-surface';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary': return 'text-primary';
      case 'secondary': return 'text-secondary';
      default: return 'text-on-surface-variant font-bold';
    }
  };

  return (
    <View className={`px-4 py-2 border rounded-full flex-row items-center gap-2 ${getVariantStyles()} ${className}`}>
      {Icon && <Icon size={14} color={variant === 'surface' ? '#919194' : variant === 'primary' ? '#bd9dff' : '#00e3fd'} />}
      <Text className={`text-[10px] uppercase font-black tracking-widest ${getTextColor()}`}>
        {label}
      </Text>
    </View>
  );
};

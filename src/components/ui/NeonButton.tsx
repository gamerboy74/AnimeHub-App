import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { haptic } from '../../lib/haptics';

interface NeonButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  className?: string;
}

export const NeonButton: React.FC<NeonButtonProps> = ({ 
  title, 
  onPress, 
  variant = 'primary',
  className = ''
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-primary shadow-[0_0_15px_rgba(255,43,60,0.4)]';
      case 'secondary':
        return 'bg-secondary shadow-[0_0_15px_rgba(0,227,253,0.4)]';
      case 'outline':
        return 'bg-transparent border border-primary/40';
      default:
        return 'bg-primary';
    }
  };

  const getTextColor = () => {
    return variant === 'outline' ? 'text-primary' : 'text-white';
  };

  return (
    <TouchableOpacity 
      onPress={() => {
        haptic.light();
        onPress?.();
      }}
      accessibilityRole="button"
      activeOpacity={0.7}
      className={`px-8 py-4 min-h-[44px] rounded-full flex-row items-center justify-center ${getVariantStyles()} ${className}`}
    >
      <Text className={`font-black text-sm uppercase tracking-widest ${getTextColor()}`}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

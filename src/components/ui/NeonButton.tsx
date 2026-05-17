import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';


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
        return 'bg-primary shadow-[0_0_15px_rgba(189,157,255,0.4)]';
      case 'secondary':
        return 'bg-secondary shadow-[0_0_15px_rgba(0,227,253,0.4)]';
      case 'outline':
        return 'bg-transparent border border-primary/40';
      default:
        return 'bg-primary';
    }
  };

  const getTextColor = () => {
    return variant === 'outline' ? 'text-primary' : 'text-on-primary-container';
  };

  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.7}
      className={`px-8 py-4 rounded-full flex-row items-center justify-center ${getVariantStyles()} ${className}`}
    >
      <Text className={`font-black text-sm uppercase tracking-widest ${getTextColor()}`}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

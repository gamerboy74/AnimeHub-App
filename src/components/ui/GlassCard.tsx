import React from 'react';
import { View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';


interface GlassCardProps extends ViewProps {
  intensity?: number;
  tint?: 'dark' | 'light' | 'default';
  children: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
  intensity = 40, 
  tint = 'dark', 
  children, 
  className = '',
  gradient = true,
  ...props 
}) => {
  return (
    <View className={`rounded-3xl overflow-hidden border border-primary/20 shadow-2xl ${className}`} {...props}>
      <BlurView intensity={intensity} tint={tint} style={{ flex: 1 }}>
        <View className={`p-6 bg-surface/20 ${gradient ? 'bg-gradient-to-b from-white/10 to-transparent' : ''}`}>
          {children}
        </View>
      </BlurView>
    </View>
  );
};

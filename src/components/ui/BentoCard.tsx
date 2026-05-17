import React from 'react';
import { View, Text, ImageBackground, TouchableOpacity } from 'react-native';
import { Star } from 'lucide-react-native';


interface BentoCardProps {
  title: string;
  genre: string;
  rating: number;
  image: string;
  className?: string;
  onPress?: () => void;
  variant?: 'large' | 'medium' | 'small';
}

export const BentoCard: React.FC<BentoCardProps> = ({ 
  title, 
  genre, 
  rating, 
  image, 
  className = '',
  onPress,
  variant = 'medium'
}) => {
  const getAspectRatio = () => {
    switch (variant) {
      case 'large': return 'aspect-[16/9]';
      case 'small': return 'aspect-square';
      default: return 'aspect-[2/3]';
    }
  };

  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.9}
      className={`rounded-2xl overflow-hidden shadow-2xl relative ${getAspectRatio()} ${className}`}
    >
      <ImageBackground 
        source={{ uri: image }} 
        className="w-full h-full"
        resizeMode="cover"
      >
        <View className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent p-4 flex flex-col justify-end">
          <View className="absolute top-2 right-2 flex-row items-center gap-1 bg-background/60 px-2 py-1 rounded-lg border border-primary/20 backdrop-blur-md">
            <Star size={10} color="#00e3fd" fill="#00e3fd" />
            <Text className="text-[10px] font-black text-on-surface">{rating.toFixed(1)}</Text>
          </View>
          
          <Text className="text-secondary font-black text-[10px] uppercase tracking-widest mb-1">{genre}</Text>
          <Text className="text-on-surface font-headline font-bold text-lg leading-tight line-clamp-2">{title}</Text>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
};

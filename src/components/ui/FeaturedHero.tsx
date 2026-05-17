import React from 'react';
import { View, Text, ImageBackground, TouchableOpacity } from 'react-native';
import { Play, Plus } from 'lucide-react-native';
import { NeonButton } from './NeonButton';


interface FeaturedHeroProps {
  anime: {
    title: string;
    image_url: string;
    genre?: string;
    score?: number;
  };
  onPress?: () => void;
}

export const FeaturedHero: React.FC<FeaturedHeroProps> = ({ anime, onPress }) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      activeOpacity={0.9}
      className="w-full h-[450px] rounded-[32px] overflow-hidden border border-primary/30 shadow-[0_20px_50px_rgba(189,157,255,0.2)]"
    >
      <ImageBackground 
        source={{ uri: anime.image_url }} 
        className="w-full h-full"
        resizeMode="cover"
      >
        <View className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent p-8 justify-end">
          <View className="mb-2 flex-row items-center gap-2">
            <View className="bg-secondary/20 px-3 py-1 rounded-full border border-secondary/40">
               <Text className="text-secondary font-black text-[10px] uppercase tracking-widest">{anime.genre || 'Epic Scale'}</Text>
            </View>
            <Text className="text-on-surface-variant font-bold text-xs">Score: {anime.score || '9.0'}</Text>
          </View>
          
          <Text className="text-on-surface text-5xl font-headline font-black uppercase tracking-tighter leading-[0.9] mb-6">
            {anime.title}
          </Text>

          <View className="flex-row gap-3">
            <NeonButton 
              title="Watch Now" 
              variant="primary" 
              className="flex-1"
            />
            <TouchableOpacity className="w-14 h-14 rounded-2xl bg-surface/80 border border-primary/20 items-center justify-center backdrop-blur-md">
              <Plus size={24} color="#bd9dff" />
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );
};

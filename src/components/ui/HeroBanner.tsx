import React from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Play } from 'lucide-react-native';
import { AnimeWithStats } from '../../types/database';

const { width } = Dimensions.get('window');

interface HeroBannerProps {
  anime: AnimeWithStats;
  onPress: (id: string) => void;
  onPlay: (anime: AnimeWithStats) => void;
}

export function HeroBanner({ anime, onPress, onPlay }: HeroBannerProps) {
  if (!anime) return <View className="h-96 bg-surface" />;

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(anime.id)} className="w-full relative bg-background">
      <View style={{ width, height: 450 }}>
        <Image
          source={{ uri: anime.banner_url || anime.poster_url }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
        {/* Top gradient for status bar visibility */}
        <LinearGradient
          colors={['rgba(8,8,16,0.6)', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100 }}
        />
        {/* Bottom gradient to blend into background */}
        <LinearGradient
          colors={['transparent', 'rgba(8,8,16,0.8)', '#080810']}
          style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 250 }}
        />
      </View>

      <View className="absolute bottom-10 left-0 right-0 px-6 items-center">
        {/* Genres */}
        <View className="flex-row gap-2 mb-3">
          {anime.genres?.slice(0, 3).map((genre, index) => (
            <Text key={index} className="text-primary font-bold text-xs uppercase tracking-widest font-['SpaceGrotesk']">
              {genre} {index < (anime.genres?.slice(0, 3).length || 0) - 1 ? '•' : ''}
            </Text>
          ))}
        </View>

        {/* Title */}
        <Text className="text-text-main text-4xl font-bold text-center mb-6 font-['SpaceGrotesk']" numberOfLines={2}>
          {anime.title}
        </Text>

        {/* Play Button Row */}
        <View className="flex-row w-full justify-center space-x-4 gap-4">
          <TouchableOpacity 
            onPress={() => onPlay(anime)}
            className="bg-primary flex-row items-center justify-center py-3 px-8 rounded-full"
            style={{
              shadowColor: '#BF5FFF',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 12,
              elevation: 10,
            }}
          >
            <Play color="#080810" size={20} fill="#080810" />
            <Text className="text-[#080810] font-bold text-lg ml-2 font-['SpaceGrotesk']">Watch Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

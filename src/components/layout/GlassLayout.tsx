import React from 'react';
import { View, ScrollView, Text, SafeAreaView, StatusBar, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { Search, User } from 'lucide-react-native';


interface GlassLayoutProps {
  children: React.ReactNode;
  title?: string;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
}

export const GlassLayout: React.FC<GlassLayoutProps> = ({ 
  children, 
  title = "NEON CURATOR",
  showSearch = true,
  onSearch
}) => {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="light-content" />
      
      {/* Blurred Header */}
      <View className="absolute top-0 left-0 right-0 z-50 h-[100px] shadow-[0_4px_30px_rgba(189,157,255,0.1)]">
        <BlurView intensity={60} tint="dark" className="flex-1 px-6 pt-12 pb-4 flex-row justify-between items-center bg-[#0e0e11]/40">
          <View className="flex-row items-center gap-3">
             <View className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 items-center justify-center">
                <User size={16} color="#bd9dff" />
             </View>
             <Text className="text-xl font-black tracking-tighter text-primary uppercase font-['Space_Grotesk']">
               {title}
             </Text>
          </View>
          
          {showSearch && (
            <View className="flex-row items-center bg-surface/40 px-3 py-2 rounded-xl border border-primary/20">
              <Search size={16} color="#bd9dff" />
              <TextInput 
                placeholder="Search Nexus..."
                placeholderTextColor="#919194"
                className="ml-2 text-on-surface text-xs min-w-[100px]"
                onChangeText={onSearch}
              />
            </View>
          )}
        </BlurView>
      </View>

      {/* Main Content */}
      <ScrollView 
        className="flex-1 mt-[100px]"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      
      {/* Blurred Tab Bar Placeholder */}
      <View className="absolute bottom-6 left-6 right-6 h-16 rounded-3xl overflow-hidden border border-primary/20 bg-[#131316]/60 shadow-[0_-10px_40px_rgba(189,157,255,0.05)]">
        <BlurView intensity={80} tint="dark" className="flex-1 flex-row justify-around items-center px-4">
          <Text className="text-primary font-bold text-[10px] uppercase tracking-widest">Home</Text>
          <Text className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Explore</Text>
          <Text className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Library</Text>
          <Text className="text-on-surface-variant font-bold text-[10px] uppercase tracking-widest">Admin</Text>
        </BlurView>
      </View>
    </SafeAreaView>
  );
};

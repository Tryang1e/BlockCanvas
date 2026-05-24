-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  role TEXT DEFAULT 'creator',
  creator_name TEXT UNIQUE,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  commission_open BOOLEAN DEFAULT false,
  discord_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Create portfolios table
CREATE TABLE IF NOT EXISTS public.portfolios (
  creator_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  headline TEXT,
  about_text TEXT,
  banner_url TEXT,
  contact_email TEXT,
  patreon_url TEXT,
  twitter_url TEXT,
  youtube_url TEXT,
  instagram_url TEXT,
  sns_settings JSONB DEFAULT '{"discord": true, "twitter": true, "youtube": true, "instagram": true, "patreon": false}'::jsonb
);

-- 3. Create portfolio_sections table
CREATE TABLE IF NOT EXISTS public.portfolio_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  section_type TEXT DEFAULT 'image_grid',
  show_title BOOLEAN DEFAULT true
);

-- 4. Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  content JSONB,
  category_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  section_id UUID REFERENCES public.portfolio_sections(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  youtube_url TEXT
);

-- 5. Create project_widgets table
CREATE TABLE IF NOT EXISTS public.project_widgets (
  id TEXT PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  content JSONB,
  sort_order INTEGER DEFAULT 0
);

-- 6. Setup Storage for uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('projects', 'projects', true) ON CONFLICT (id) DO NOTHING;

-- Allow public access to read files
CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING ( bucket_id = 'projects' );
CREATE POLICY "Insert Access" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'projects' );
CREATE POLICY "Update Access" ON storage.objects FOR UPDATE USING ( bucket_id = 'projects' );
CREATE POLICY "Delete Access" ON storage.objects FOR DELETE USING ( bucket_id = 'projects' );

-- 7. Disable RLS for local dev to avoid permission issues without real auth setup
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_sections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_widgets DISABLE ROW LEVEL SECURITY;

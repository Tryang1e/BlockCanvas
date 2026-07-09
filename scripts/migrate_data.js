require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({});

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://luqtkroovfowmwquwipx.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1cXRrcm9vdmZvd213cXV3aXB4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NDg1MjksImV4cCI6MjA5MjQyNDUyOX0.ddqPClhIDY7hUi86N0ZicrfW1FrLTedxxBfWHGLdi20";

async function fetchSupabase(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.statusText}`);
  return res.json();
}

async function migrate() {
  console.log('Starting migration from remote Supabase to local SQLite...');

  try {
    // 1. Fetch data
    const profiles = await fetchSupabase('profiles');
    const portfolios = await fetchSupabase('portfolios');
    const sections = await fetchSupabase('portfolio_sections');
    const projects = await fetchSupabase('projects');
    const widgets = await fetchSupabase('project_widgets');

    console.log(`Fetched: ${profiles.length} profiles, ${portfolios.length} portfolios, ${sections.length} sections, ${projects.length} projects, ${widgets.length} widgets.`);

    // 2. Clear existing data
    await prisma.projectWidget.deleteMany();
    await prisma.project.deleteMany();
    await prisma.portfolioSection.deleteMany();
    await prisma.portfolio.deleteMany();
    await prisma.profile.deleteMany();

    // 3. Insert Profiles
    for (const p of profiles) {
      await prisma.profile.create({
        data: {
          id: p.id,
          role: p.role || 'creator',
          creator_name: p.creator_name,
          display_name: p.display_name,
          email: p.email,
          avatar_url: p.avatar_url,
          commission_open: p.commission_open,
          discord_id: p.discord_id,
          created_at: new Date(p.created_at)
        }
      });
    }

    // 4. Insert Portfolios
    for (const p of portfolios) {
      await prisma.portfolio.create({
        data: {
          creator_id: p.creator_id,
          headline: p.headline,
          about_text: p.about_text,
          banner_url: p.banner_url,
          contact_email: p.contact_email,
          patreon_url: p.patreon_url,
          twitter_url: p.twitter_url,
          youtube_url: p.youtube_url,
          instagram_url: p.instagram_url,
          sns_settings: typeof p.sns_settings === 'string' ? p.sns_settings : JSON.stringify(p.sns_settings)
        }
      });
    }

    // 5. Insert Sections
    for (const s of sections) {
      await prisma.portfolioSection.create({
        data: {
          id: s.id,
          creator_id: s.creator_id,
          name: s.name,
          sort_order: s.sort_order,
          created_at: new Date(s.created_at),
          section_type: s.section_type,
          show_title: s.show_title,
          content: s.content || null
        }
      });
    }

    // 6. Insert Projects
    for (const p of projects) {
      await prisma.project.create({
        data: {
          id: p.id,
          creator_id: p.creator_id,
          title: p.title,
          description: p.description,
          thumbnail_url: p.thumbnail_url,
          content: typeof p.content === 'string' ? p.content : JSON.stringify(p.content),
          category_id: p.category_id ? p.category_id.toString() : null,
          created_at: new Date(p.created_at),
          section_id: p.section_id,
          sort_order: p.sort_order,
          youtube_url: p.youtube_url,
          is_published: true // Supabase didn't have this field originally, default to true
        }
      });
    }

    // 7. Insert Widgets
    for (const w of widgets) {
      await prisma.projectWidget.create({
        data: {
          id: w.id,
          project_id: w.project_id,
          type: w.type || w.widget_type, // Handling potential column rename
          content: typeof w.content === 'string' ? w.content : JSON.stringify(w.content),
          sort_order: w.sort_order
        }
      });
    }

    console.log('Migration completed successfully! 🎉');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();

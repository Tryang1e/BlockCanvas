import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    let fetchUrl = url;
    try {
      const urlObj = new URL(url);
      
      if (urlObj.hostname === 'instagram.com' || urlObj.hostname === 'www.instagram.com') {
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && !['p', 'reel', 'explore', 'stories'].includes(pathParts[0])) {
          const username = pathParts[0];
          return NextResponse.json({
            title: `${username} (@${username}) • Instagram photos and videos`,
            description: `View ${username}'s profile on Instagram.`,
            image: `https://unavatar.io/instagram/${username}`,
            favicon: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png',
            url
          });
        } else {
          return NextResponse.json({
            title: 'Instagram',
            description: 'View this post on Instagram',
            image: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png',
            favicon: 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png',
            url
          });
        }
      }

      if (urlObj.hostname === 'twitter.com' || urlObj.hostname === 'www.twitter.com' || urlObj.hostname === 'x.com' || urlObj.hostname === 'www.x.com') {
        urlObj.hostname = 'vxtwitter.com';
        fetchUrl = urlObj.toString();
      }
    } catch (e) {
      // Ignore URL parsing errors
    }

    const response = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch the URL');
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const title = 
      $('meta[property="og:title"]').attr('content') || 
      $('meta[name="twitter:title"]').attr('content') ||
      $('title').text() || 
      '';
      
    const description = 
      $('meta[property="og:description"]').attr('content') || 
      $('meta[name="twitter:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') || 
      '';
      
    const image = 
      $('meta[property="og:image"]').attr('content') || 
      $('meta[name="twitter:image"]').attr('content') || 
      $('link[rel="apple-touch-icon"]').attr('href') ||
      '';

    let favicon = $('link[rel="icon"]').attr('href') || $('link[rel="shortcut icon"]').attr('href') || '';
    if (!favicon) {
      if (url.includes('twitter.com') || url.includes('x.com')) favicon = 'https://abs.twimg.com/favicons/twitter.2.ico';
      if (url.includes('instagram.com')) favicon = 'https://static.cdninstagram.com/rsrc.php/v3/yI/r/VsKofmUGAk-.png';
    }
    if (favicon && !favicon.startsWith('http')) {
      const urlObj = new URL(url);
      favicon = new URL(favicon, urlObj.origin).toString();
    }
    
    // Attempt to make image URL absolute if it is relative
    let absoluteImage = image;
    if (image && !image.startsWith('http')) {
       try {
         const urlObj = new URL(url);
         absoluteImage = new URL(image, urlObj.origin).toString();
       } catch (e) {
         // ignore
       }
    }

    return NextResponse.json({
      title,
      description,
      image: absoluteImage,
      favicon,
      url
    });

  } catch (error) {
    console.error('Metadata API Error:', error);
    return NextResponse.json({ error: 'Failed to fetch metadata' }, { status: 500 });
  }
}

import { promises as fs } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

export async function deleteUserPhysicalFiles(profileId: string) {
  try {
    const urlsToDelete = new Set<string>()

    // 1. Get Profile avatar
    const profile = await prisma.profile.findUnique({
      where: { id: profileId },
      select: { avatar_url: true }
    })
    if (profile?.avatar_url) {
      urlsToDelete.add(profile.avatar_url)
    }

    // 2. Get Portfolio banner
    const portfolio = await prisma.portfolio.findUnique({
      where: { creator_id: profileId },
      select: { banner_url: true }
    })
    if (portfolio?.banner_url) {
      urlsToDelete.add(portfolio.banner_url)
    }

    // 3. Get Project thumbnails, content and widgets
    const projects = await prisma.project.findMany({
      where: { creator_id: profileId },
      select: { id: true, thumbnail_url: true, content: true }
    })

    for (const project of projects) {
      if (project.thumbnail_url) {
        urlsToDelete.add(project.thumbnail_url)
      }
      if (project.content) {
        scanForUploadUrls(project.content, urlsToDelete)
      }

      // Project widgets
      const widgets = await prisma.projectWidget.findMany({
        where: { project_id: project.id },
        select: { content: true }
      })
      for (const widget of widgets) {
        if (widget.content) {
          scanForUploadUrls(widget.content, urlsToDelete)
        }
      }
    }

    // 4. Get WIP logs
    const wipLogs = await prisma.wipLog.findMany({
      where: { creator_id: profileId },
      select: { media_url: true }
    })
    for (const log of wipLogs) {
      if (log.media_url) {
        urlsToDelete.add(log.media_url)
      }
    }

    // 5. Physically delete files
    const uploadsRoot = path.join(process.cwd(), 'public', 'uploads')
    for (const url of urlsToDelete) {
      // Ensure the URL is a local upload and not a default avatar/banner or external URL
      if (url.startsWith('/uploads/') && !url.includes('default_avatar.png') && !url.includes('default_banner.png')) {
        // Map public URL to local public folder file path
        const relativePath = url.replace(/^\//, '') // remove leading slash
        const absolutePath = path.resolve(process.cwd(), 'public', relativePath)

        // 경로 탐색(Path Traversal) 방지: 반드시 uploads 디렉터리 하위여야 한다.
        // (예: '/uploads/../../dev.db' 같은 입력으로 DB 등 임의 파일이 삭제되는 것을 차단)
        if (absolutePath !== uploadsRoot && !absolutePath.startsWith(uploadsRoot + path.sep)) {
          console.warn(`[File Delete] Skipped path outside uploads directory: ${absolutePath}`)
          continue
        }

        try {
          // Check if file exists before deleting
          await fs.access(absolutePath)
          await fs.unlink(absolutePath)
        } catch (e) {
          // File might not exist or be inaccessible, just ignore
          console.warn(`[File Delete] File was not found or could not be accessed: ${absolutePath}`)
        }
      }
    }
  } catch (error) {
    console.error('[File Delete] Error during physical file deletion:', error)
  }
}

function scanForUploadUrls(text: string, set: Set<string>) {
  // Regex to match any instances of /uploads/projects/<filename> or similar
  const regex = /\/uploads\/[a-zA-Z0-9.\-_/]+/g
  const matches = text.match(regex)
  if (matches) {
    for (const match of matches) {
      set.add(match)
    }
  }
}

/**
 * 一次性写入超级管理员（存在则按邮箱更新密码与角色）。
 * 运行: node scripts/seed-superadmin.mjs
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const envPath = resolve(process.cwd(), '.env')
if (existsSync(envPath)) {
  const txt = readFileSync(envPath, 'utf8')
  for (const line of txt.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }
    const eq = trimmed.indexOf('=')
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith('\'') && val.endsWith('\''))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) {
        process.env[key] = val
      }
    }
  }
}

const prisma = new PrismaClient()

const LEGACY_EMAIL = 'zhaohaitao9986@email.com'

const SUPERADMIN = {
  name: 'zhaohaitao',
  email: 'zhaohaitao9986@gmail.com',
  passwordPlain: 'ZHAOhaitao98092.',
  role: 'SUPERADMIN',
}

async function main() {
  const legacy = await prisma.user.findUnique({ where: { email: LEGACY_EMAIL } })
  if (legacy) {
    await prisma.user.update({
      where: { email: LEGACY_EMAIL },
      data: { email: SUPERADMIN.email },
    })
    console.log('已更正邮箱:', LEGACY_EMAIL, '->', SUPERADMIN.email)
  }

  const hash = await bcrypt.hash(SUPERADMIN.passwordPlain, 10)
  const row = await prisma.user.upsert({
    where: { email: SUPERADMIN.email },
    create: {
      name: SUPERADMIN.name,
      email: SUPERADMIN.email,
      password: hash,
      role: SUPERADMIN.role,
      isActive: true,
    },
    update: {
      name: SUPERADMIN.name,
      password: hash,
      role: SUPERADMIN.role,
      isActive: true,
    },
  })
  console.log('OK:', { id: row.id, email: row.email, role: row.role })
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())

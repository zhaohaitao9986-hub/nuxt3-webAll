<script setup>

import { ElMessage } from 'element-plus'

definePageMeta({
  layout: 'admin',
})

const route = useRoute()
const router = useRouter()

const idParam = computed(() => {
  const raw = route.query.id
  if (raw === undefined || raw === null || raw === '') {
    return null
  }
  const n = Number(raw)
  return Number.isNaN(n) ? null : n
})

const isEdit = computed(() => idParam.value != null)

const pageTitle = computed(() => (isEdit.value ? '编辑 AI 工具' : '新建 AI 工具'))

const loading = ref(false)
const submitting = ref(false)
const formRef = ref(null)

const categoryOptions = ref([])

/** 用户是否手动改过 handle，为 true 时不再随 name 自动改写 */
const handleLocked = ref(false)

const form = reactive({
  name: '',
  website: '',
  handle: '',
  is_free: false,
  is_ad: false,
  categoryIds: [],
  description: '',
  pros: [],
  cons: [],
  pricing: [],
  seo_title: '',
  seo_keywords: '',
})

const faqRows = ref([])

const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  handle: [{ required: true, message: '请输入或生成 handle（slug）', trigger: 'blur' }],
}

function slugifyName(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
}

watch(
  () => form.name,
  (n) => {
    if (handleLocked.value) {
      return
    }
    form.handle = slugifyName(n)
  },
)

function onHandleManualInput() {
  handleLocked.value = true
}

function faqJsonToRows(json) {
  if (json == null) {
    return []
  }
  if (typeof json === 'object' && !Array.isArray(json)) {
    return Object.entries(json).map(([key, value]) => ({
      key: String(key),
      value: value == null ? '' : String(value),
    }))
  }
  if (Array.isArray(json)) {
    return json.map((item) => {
      if (item && typeof item === 'object' && ('key' in item || 'question' in item)) {
        const k = item.key ?? item.question ?? ''
        const v = item.value ?? item.answer ?? ''
        return { key: String(k), value: String(v) }
      }
      return { key: '', value: '' }
    })
  }
  return []
}

function faqRowsToObject(rows) {
  const out = {}
  for (const r of rows) {
    const k = String(r.key || '').trim()
    if (!k) {
      continue
    }
    out[k] = r.value ?? ''
  }
  return Object.keys(out).length ? out : null
}

function addFaqRow() {
  faqRows.value.push({ key: '', value: '' })
}

function removeFaqRow(index) {
  faqRows.value.splice(index, 1)
}

function resetFormForCreate() {
  handleLocked.value = false
  form.name = ''
  form.website = ''
  form.handle = ''
  form.is_free = false
  form.is_ad = false
  form.categoryIds = []
  form.description = ''
  form.pros = []
  form.cons = []
  form.pricing = []
  form.seo_title = ''
  form.seo_keywords = ''
  faqRows.value = []
}

async function loadCategories() {
  try {
    const res = await $fetch('/api/admin/categories/options')
    categoryOptions.value = res.data || []
  }
  catch {
    categoryOptions.value = []
  }
}

function applyToolToForm(row) {
  handleLocked.value = true
  form.name = row.name ?? ''
  form.website = row.website ?? ''
  form.handle = row.handle ?? ''
  form.is_free = Boolean(row.is_free)
  form.is_ad = Boolean(row.is_ad)
  form.description = row.description ?? ''
  form.pros = Array.isArray(row.pros) ? [...row.pros] : []
  form.cons = Array.isArray(row.cons) ? [...row.cons] : []
  form.pricing = Array.isArray(row.pricing) ? [...row.pricing] : []
  form.seo_title = row.seo_title ?? ''
  form.seo_keywords = row.seo_keywords ?? ''
  form.categoryIds = Array.isArray(row.categoryIds) ? [...row.categoryIds] : []
  faqRows.value = faqJsonToRows(row.faq)
  if (!faqRows.value.length) {
    faqRows.value = []
  }
}

async function loadTool() {
  if (!isEdit.value) {
    resetFormForCreate()
    return
  }
  loading.value = true
  try {
    const row = await $fetch(`/api/admin/tools/${idParam.value}`)
    applyToolToForm(row)
  }
  catch (e) {
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '加载失败')
    await router.replace('/admin/tools')
  }
  finally {
    loading.value = false
  }
}

async function onSubmit() {
  const el = formRef.value
  if (!el) {
    return
  }
  try {
    await el.validate()
  }
  catch {
    ElMessage.warning('请检查表单必填项')
    return
  }

  const faq = faqRowsToObject(faqRows.value)

  const body = {
    name: form.name.trim(),
    handle: form.handle.trim(),
    website: form.website?.trim() || null,
    description: form.description?.trim() || null,
    is_free: form.is_free,
    is_ad: form.is_ad,
    categoryIds: form.categoryIds,
    pros: form.pros,
    cons: form.cons,
    pricing: form.pricing,
    seo_title: form.seo_title?.trim() || null,
    seo_keywords: form.seo_keywords?.trim() || null,
    faq,
  }

  if (!body.handle) {
    ElMessage.warning('handle 不能为空')
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await $fetch(`/api/admin/tools/${idParam.value}`, {
        method: 'PUT',
        body,
      })
      ElMessage.success('已保存')
    }
    else {
      await $fetch('/api/admin/tools', {
        method: 'POST',
        body,
      })
      ElMessage.success('已创建')
    }
    await router.push('/admin/tools')
  }
  catch (e) {
    ElMessage.error(e?.data?.statusMessage || e?.data?.message || e?.message || '保存失败')
  }
  finally {
    submitting.value = false
  }
}

function onCancel() {
  router.push('/admin/tools')
}

watch(
  () => route.query.id,
  () => {
    loadTool()
  },
)

onMounted(async () => {
  await loadCategories()
  await loadTool()
})
</script>

<template>
  <div v-loading="loading" class="tool-edit-page">
    <div class="tool-edit-head">
      <h2 class="tool-edit-title">
        {{ pageTitle }}
      </h2>
      <div class="tool-edit-actions">
        <el-button @click="onCancel">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="onSubmit"
        >
          保存
        </el-button>
      </div>
    </div>

    <el-card shadow="never" class="tool-edit-card">
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="120px"
        label-position="right"
        class="tool-edit-form"
      >
        <el-tabs type="border-card" class="tool-edit-tabs">
          <el-tab-pane label="基础信息" name="base">
            <el-form-item label="名称" prop="name">
              <el-input v-model="form.name" placeholder="工具名称" clearable maxlength="200" show-word-limit />
            </el-form-item>
            <el-form-item label="官网链接" prop="website">
              <el-input v-model="form.website" placeholder="https://…" clearable />
            </el-form-item>
            <el-form-item label="Handle" prop="handle">
              <el-input
                v-model="form.handle"
                placeholder="URL slug，可随名称自动生成"
                clearable
                @input="onHandleManualInput"
              />
            </el-form-item>
            <el-form-item label="分类">
              <el-select
                v-model="form.categoryIds"
                multiple
                filterable
                clearable
                collapse-tags
                collapse-tags-tooltip
                placeholder="选择二级分类（可多选）"
                style="width: 100%; max-width: 560px"
              >
                <el-option
                  v-for="opt in categoryOptions"
                  :key="opt.id"
                  :label="opt.label"
                  :value="opt.id"
                />
              </el-select>
            </el-form-item>
            <el-form-item label="免费工具">
              <el-switch v-model="form.is_free" />
            </el-form-item>
            <el-form-item label="推广 / 广告">
              <el-switch v-model="form.is_ad" />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="内容详情" name="content">
            <el-form-item label="描述">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="8"
                placeholder="长文本介绍"
                maxlength="20000"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="优点">
              <el-select
                v-model="form.pros"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="输入后回车可添加标签"
                style="width: 100%; max-width: 640px"
              />
            </el-form-item>
            <el-form-item label="缺点">
              <el-select
                v-model="form.cons"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="输入后回车可添加标签"
                style="width: 100%; max-width: 640px"
              />
            </el-form-item>
            <el-form-item label="定价说明">
              <el-select
                v-model="form.pricing"
                multiple
                filterable
                allow-create
                default-first-option
                placeholder="如：免费 / Pro $9/mo"
                style="width: 100%; max-width: 640px"
              />
            </el-form-item>
          </el-tab-pane>

          <el-tab-pane label="SEO 与其他" name="seo">
            <el-form-item label="SEO 标题">
              <el-input v-model="form.seo_title" placeholder="独立 title" clearable maxlength="200" show-word-limit />
            </el-form-item>
            <el-form-item label="SEO 关键词">
              <el-input v-model="form.seo_keywords" placeholder="英文逗号分隔" clearable maxlength="500" show-word-limit />
            </el-form-item>
            <el-form-item label="FAQ">
              <div class="faq-editor">
                <div
                  v-for="(row, index) in faqRows"
                  :key="index"
                  class="faq-row"
                >
                  <el-input v-model="row.key" placeholder="键 / 问题" clearable />
                  <el-input v-model="row.value" placeholder="值 / 答案" clearable type="textarea" :rows="2" />
                  <el-button type="danger" link @click="removeFaqRow(index)">
                    删除
                  </el-button>
                </div>
                <el-button type="primary" link @click="addFaqRow">
                  + 添加键值对
                </el-button>
              </div>
            </el-form-item>
          </el-tab-pane>
        </el-tabs>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.tool-edit-page {
  max-width: 960px;
}

.tool-edit-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 16px;
  flex-wrap: wrap;
}

.tool-edit-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.tool-edit-actions {
  display: flex;
  gap: 8px;
}

.tool-edit-card :deep(.el-card__body) {
  padding: 16px 20px 24px;
}

.tool-edit-tabs :deep(.el-tab-pane) {
  padding-top: 16px;
}

.tool-edit-form :deep(.el-form-item) {
  max-width: 720px;
}

.faq-editor {
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.faq-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) auto;
  gap: 8px;
  align-items: start;
}
</style>

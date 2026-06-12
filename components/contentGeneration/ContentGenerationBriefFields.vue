<script setup>
const props = defineProps({
  form: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
})

const adminAxios = useAdminAxios()
const contentType = computed(() => String(props.form.contentType || '').toUpperCase())
const showCommonSeo = computed(() => ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(contentType.value))
const showCompareCascade = computed(() => ['COMPARISON', 'ALTERNATIVE'].includes(contentType.value))
const level1Options = ref([])
const categoryOptions = ref([])
const selectedLevel1Id = ref('')
const toolOptions = ref([])
const toolLoading = ref(false)

function mergeTools(rows) {
  const byId = new Map(toolOptions.value.map(tool => [tool.id, tool]))
  for (const tool of rows || []) byId.set(tool.id, tool)
  toolOptions.value = [...byId.values()]
}

function selectedToolIds() {
  return new Set([
    ...(props.form.selectedToolIds || []),
    props.form.primaryToolId,
    props.form.secondaryToolId,
    ...(props.form.alternativeToolIds || []),
  ].filter(Boolean).map(Number))
}

async function searchTools(query = '') {
  toolLoading.value = true
  try {
    const response = await adminAxios.get('/api/admin/content-generation/tools/search', {
      params: { q: query.trim(), categoryId: showCompareCascade.value ? props.form.categoryId || undefined : undefined },
    })
    const selectedIds = selectedToolIds()
    const selectedOptions = toolOptions.value.filter(tool => selectedIds.has(Number(tool.id)))
    toolOptions.value = []
    mergeTools([...selectedOptions, ...(response.data?.data || [])])
  }
  catch {
    // Keep already selected options available when a remote search fails.
  }
  finally {
    toolLoading.value = false
  }
}

async function onToolDropdownVisible(visible) {
  if (!visible) return
  if (showCompareCascade.value && !props.form.categoryId) return
  await searchTools('')
}

async function loadCategoryOptions() {
  try {
    const [level1Response, categoryResponse] = await Promise.all([
      adminAxios.get('/api/admin/categories/level1-options'),
      adminAxios.get('/api/admin/categories/options'),
    ])
    level1Options.value = level1Response.data?.data || []
    categoryOptions.value = categoryResponse.data?.data || []
    syncSelectedLevel1()
  }
  catch {
    level1Options.value = []
    categoryOptions.value = []
  }
}

const filteredCategoryOptions = computed(() => categoryOptions.value.filter(
  category => Number(category.level1Id) === Number(selectedLevel1Id.value),
))

function syncSelectedLevel1() {
  const category = categoryOptions.value.find(item => Number(item.id) === Number(props.form.categoryId))
  if (category) selectedLevel1Id.value = category.level1Id
}

function clearToolSelections() {
  props.form.primaryToolId = ''
  props.form.secondaryToolId = ''
  props.form.alternativeToolIds = []
  toolOptions.value = []
}

function onLevel1Change() {
  props.form.categoryId = ''
  clearToolSelections()
}

async function onCategoryChange() {
  clearToolSelections()
  if (props.form.categoryId) await searchTools()
}

function onPrimaryToolChange() {
  if (Number(props.form.secondaryToolId) === Number(props.form.primaryToolId)) props.form.secondaryToolId = ''
  props.form.alternativeToolIds = (props.form.alternativeToolIds || []).filter(
    id => Number(id) !== Number(props.form.primaryToolId),
  )
}

async function loadSelectedTools() {
  const ids = [
    ...(props.form.selectedToolIds || []),
    props.form.primaryToolId,
    props.form.secondaryToolId,
    ...(props.form.alternativeToolIds || []),
  ].filter(Boolean)
  if (!ids.length) return
  try {
    const response = await adminAxios.get('/api/admin/content-generation/tools/search', { params: { ids: ids.join(',') } })
    mergeTools(response.data?.data || [])
  }
  catch {
    // The form values remain intact even when labels cannot be refreshed.
  }
}

function toolLabel(tool) {
  return tool.name
}

onMounted(async () => {
  await loadCategoryOptions()
  await Promise.all([searchTools(), loadSelectedTools()])
})

watch(() => props.form.categoryId, syncSelectedLevel1)
watch(contentType, (type, previousType) => {
  if (previousType && type !== previousType) selectedLevel1Id.value = ''
})
</script>

<template>
  <template v-if="showCompareCascade">
    <el-form-item label="一级分类" required>
      <el-select v-model="selectedLevel1Id" clearable filterable style="width: 100%" :disabled="disabled" @change="onLevel1Change">
        <el-option v-for="category in level1Options" :key="category.id" :label="category.name" :value="category.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="二级分类" required>
      <el-select v-model="form.categoryId" clearable filterable style="width: 100%" :disabled="disabled || !selectedLevel1Id" @change="onCategoryChange">
        <el-option v-for="category in filteredCategoryOptions" :key="category.id" :label="category.name" :value="category.id" />
      </el-select>
    </el-form-item>
  </template>

  <template v-if="showCommonSeo && !compact">
    <el-form-item label="目标关键词" required>
      <el-input v-model="form.targetKeyword" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="页面目标" required>
      <el-input v-model="form.pageGoal" type="textarea" :rows="2" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="搜索意图" required>
      <el-input v-model="form.searchIntent" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="目标受众" required>
      <el-input v-model="form.audience" :disabled="disabled" />
    </el-form-item>
  </template>

  <template v-if="contentType === 'BUYER_GUIDE' && !compact">
    <el-form-item label="入选工具" required>
      <el-select v-model="form.selectedToolIds" multiple filterable clearable collapse-tags style="width: 100%" :disabled="disabled" :loading="toolLoading" :filter-method="searchTools" @visible-change="onToolDropdownVisible">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="决策标准" required>
      <el-input v-model="form.decisionCriteriaText" type="textarea" :rows="4" placeholder="每行一个，至少 5 条" :disabled="disabled" />
    </el-form-item>
  </template>

  <template v-if="contentType === 'TUTORIAL'">
    <el-form-item label="主工具" required>
      <el-select v-model="form.primaryToolId" filterable clearable style="width: 100%" :disabled="disabled" :loading="toolLoading" :filter-method="searchTools" @visible-change="onToolDropdownVisible">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="!compact" label="教程目标" required>
      <el-input v-model="form.tutorialGoal" type="textarea" :rows="2" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="工作流步骤" required>
      <el-input v-model="form.workflowContextText" type="textarea" :rows="5" placeholder="每行一步，或输入 JSON 数组" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="前置知识">
      <el-input v-model="form.prerequisiteKnowledgeText" type="textarea" :rows="3" placeholder="每行一项" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="输出检查" required>
      <el-input v-model="form.outputChecklistText" type="textarea" :rows="3" placeholder="每行一项" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="常见错误">
      <el-input v-model="form.commonMistakesText" type="textarea" :rows="3" placeholder="每行一项" :disabled="disabled" />
    </el-form-item>
  </template>

  <template v-if="contentType === 'COMPARISON'">
    <el-form-item label="主工具" required>
      <el-select v-model="form.primaryToolId" filterable clearable style="width: 100%" :disabled="disabled || !form.categoryId" :loading="toolLoading" :filter-method="searchTools" @change="onPrimaryToolChange" @visible-change="onToolDropdownVisible">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="对比工具" required>
      <el-select v-model="form.secondaryToolId" filterable clearable style="width: 100%" :disabled="disabled || !form.categoryId" :loading="toolLoading" :filter-method="searchTools" @visible-change="onToolDropdownVisible">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" :disabled="Number(tool.id) === Number(form.primaryToolId)" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="!compact" label="对比意图" required>
      <el-input v-model="form.comparisonIntent" type="textarea" :rows="2" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="目标受众" required>
      <el-input v-model="form.targetAudience" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="决策标准" required>
      <el-input v-model="form.decisionCriteriaText" type="textarea" :rows="4" placeholder="每行一个，至少 6 条" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="共同用例">
      <el-input v-model="form.sharedUseCasesText" type="textarea" :rows="3" placeholder="每行一个共同用例" :disabled="disabled" />
    </el-form-item>
  </template>

  <template v-if="contentType === 'ALTERNATIVE'">
    <el-form-item label="主工具" required>
      <el-select v-model="form.primaryToolId" filterable clearable style="width: 100%" :disabled="disabled || !form.categoryId" :loading="toolLoading" :filter-method="searchTools" @change="onPrimaryToolChange" @visible-change="onToolDropdownVisible">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="!compact" label="替代工具" required>
      <el-select v-model="form.alternativeToolIds" multiple filterable clearable collapse-tags style="width: 100%" :disabled="disabled || !form.categoryId" :loading="toolLoading" :filter-method="searchTools" @visible-change="onToolDropdownVisible">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" :disabled="Number(tool.id) === Number(form.primaryToolId)" />
      </el-select>
    </el-form-item>
    <el-form-item v-if="!compact" label="切换原因" required>
      <el-input v-model="form.reasonToSwitch" type="textarea" :rows="3" :disabled="disabled" />
    </el-form-item>
    <el-form-item v-if="!compact" label="筛选标准" required>
      <el-input v-model="form.selectionCriteriaText" type="textarea" :rows="4" placeholder="每行一个，至少 5 条" :disabled="disabled" />
    </el-form-item>
  </template>
</template>

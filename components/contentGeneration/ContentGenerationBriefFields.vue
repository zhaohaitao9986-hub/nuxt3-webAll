<script setup>
const props = defineProps({
  form: { type: Object, required: true },
  disabled: { type: Boolean, default: false },
})

const adminAxios = useAdminAxios()
const contentType = computed(() => String(props.form.contentType || '').toUpperCase())
const showCommonSeo = computed(() => ['BUYER_GUIDE', 'CATEGORY_GUIDE', 'TUTORIAL'].includes(contentType.value))
const toolOptions = ref([])
const toolLoading = ref(false)

function mergeTools(rows) {
  const byId = new Map(toolOptions.value.map(tool => [tool.id, tool]))
  for (const tool of rows || []) byId.set(tool.id, tool)
  toolOptions.value = [...byId.values()]
}

async function searchTools(query = '') {
  toolLoading.value = true
  try {
    const response = await adminAxios.get('/api/admin/content-generation/tools/search', { params: { q: query.trim() } })
    mergeTools(response.data?.data || [])
  }
  catch {
    // Keep already selected options available when a remote search fails.
  }
  finally {
    toolLoading.value = false
  }
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
  const categories = (tool.categoryNames || []).join('、')
  return `${tool.name} / ${tool.handle}${categories ? ` / ${categories}` : ''}`
}

onMounted(async () => {
  await Promise.all([searchTools(), loadSelectedTools()])
})
</script>

<template>
  <template v-if="showCommonSeo">
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

  <template v-if="contentType === 'BUYER_GUIDE'">
    <el-form-item label="入选工具" required>
      <el-select v-model="form.selectedToolIds" multiple filterable remote clearable collapse-tags style="width: 100%" :disabled="disabled" :loading="toolLoading" :remote-method="searchTools">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="决策标准" required>
      <el-input v-model="form.decisionCriteriaText" type="textarea" :rows="4" placeholder="每行一个，至少 5 条" :disabled="disabled" />
    </el-form-item>
  </template>

  <template v-if="contentType === 'TUTORIAL'">
    <el-form-item label="主工具" required>
      <el-select v-model="form.primaryToolId" filterable remote clearable style="width: 100%" :disabled="disabled" :loading="toolLoading" :remote-method="searchTools">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="教程目标" required>
      <el-input v-model="form.tutorialGoal" type="textarea" :rows="2" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="工作流步骤" required>
      <el-input v-model="form.workflowContextText" type="textarea" :rows="5" placeholder="每行一步，或输入 JSON 数组" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="前置知识">
      <el-input v-model="form.prerequisiteKnowledgeText" type="textarea" :rows="3" placeholder="每行一项" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="输出检查" required>
      <el-input v-model="form.outputChecklistText" type="textarea" :rows="3" placeholder="每行一项" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="常见错误">
      <el-input v-model="form.commonMistakesText" type="textarea" :rows="3" placeholder="每行一项" :disabled="disabled" />
    </el-form-item>
  </template>

  <template v-if="contentType === 'COMPARISON'">
    <el-form-item label="主工具" required>
      <el-select v-model="form.primaryToolId" filterable remote clearable style="width: 100%" :disabled="disabled" :loading="toolLoading" :remote-method="searchTools">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="对比工具" required>
      <el-select v-model="form.secondaryToolId" filterable remote clearable style="width: 100%" :disabled="disabled" :loading="toolLoading" :remote-method="searchTools">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="对比意图" required>
      <el-input v-model="form.comparisonIntent" type="textarea" :rows="2" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="目标受众" required>
      <el-input v-model="form.targetAudience" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="决策标准" required>
      <el-input v-model="form.decisionCriteriaText" type="textarea" :rows="4" placeholder="每行一个，至少 6 条" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="共同用例">
      <el-input v-model="form.sharedUseCasesText" type="textarea" :rows="3" placeholder="每行一个共同用例" :disabled="disabled" />
    </el-form-item>
  </template>

  <template v-if="contentType === 'ALTERNATIVE'">
    <el-form-item label="主工具" required>
      <el-select v-model="form.primaryToolId" filterable remote clearable style="width: 100%" :disabled="disabled" :loading="toolLoading" :remote-method="searchTools">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="替代工具" required>
      <el-select v-model="form.alternativeToolIds" multiple filterable remote clearable collapse-tags style="width: 100%" :disabled="disabled" :loading="toolLoading" :remote-method="searchTools">
        <el-option v-for="tool in toolOptions" :key="tool.id" :label="toolLabel(tool)" :value="tool.id" />
      </el-select>
    </el-form-item>
    <el-form-item label="切换原因" required>
      <el-input v-model="form.reasonToSwitch" type="textarea" :rows="3" :disabled="disabled" />
    </el-form-item>
    <el-form-item label="筛选标准" required>
      <el-input v-model="form.selectionCriteriaText" type="textarea" :rows="4" placeholder="每行一个，至少 5 条" :disabled="disabled" />
    </el-form-item>
  </template>
</template>

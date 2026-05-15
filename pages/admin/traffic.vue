<script setup>
import { DataAnalysis, RefreshRight } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

definePageMeta({
  layout: 'admin',
})

const filters = reactive({
  range: 'today',
  channel: '',
  device: '',
})

const rangeOptions = [
  { label: '今天', value: 'today' },
  { label: '昨天', value: 'yesterday' },
  { label: '最近 7 天', value: '7d' },
  { label: '最近 30 天', value: '30d' },
]

const deviceOptions = [
  { label: '所有设备', value: '' },
  { label: '桌面端', value: 'desktop' },
  { label: '移动端', value: 'mobile' },
  { label: '平板', value: 'tablet' },
]

const loading = reactive({
  overview: false,
  pages: false,
  hourly: false,
})

const overview = ref({
  uv: 0,
  pv: 0,
  pvPerUv: 0,
  avgPageStay: 0,
  conversions: 0,
  conversionRate: 0,
})
const realtime = ref({ activeVisitors: 0 })
const channelOptions = ref([])
const pageRows = ref([])
const hourlyRows = ref([])
const page = ref(1)
const pageSize = ref(20)
const total = ref(0)
const activeTab = ref('pages')

const hasTrafficData = computed(() => {
  return overview.value.uv > 0 || overview.value.pv > 0 || realtime.value.activeVisitors > 0 || total.value > 0
})

const statCards = computed(() => [
  { label: '访客 (UV)', value: overview.value.uv },
  { label: '浏览量 (PV)', value: overview.value.pv },
  { label: 'PV/UV', value: formatDecimal(overview.value.pvPerUv) },
  { label: '平均停留时长 (S)', value: formatDecimal(overview.value.avgPageStay) },
  { label: '转化次数', value: overview.value.conversions },
  { label: '转化率', value: `${formatDecimal(overview.value.conversionRate)}%` },
])

function buildQuery() {
  return {
    range: filters.range,
    channel: filters.channel,
    device: filters.device,
  }
}

function formatDecimal(value) {
  const num = Number(value || 0)
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

function formatPercent(value) {
  return `${formatDecimal(value)}%`
}

async function loadOverview() {
  loading.overview = true
  try {
    const res = await useAdminFetch('/api/admin/traffic/overview', {
      query: buildQuery(),
    })
    overview.value = res.overview || overview.value
    realtime.value = res.realtime || realtime.value
    channelOptions.value = Array.isArray(res.channelOptions) ? res.channelOptions : []
  }
  catch (e) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载总览失败')
  }
  finally {
    loading.overview = false
  }
}

async function loadPages() {
  loading.pages = true
  try {
    const res = await useAdminFetch('/api/admin/traffic/pages', {
      query: {
        ...buildQuery(),
        page: page.value,
        pageSize: pageSize.value,
      },
    })
    pageRows.value = res.data || []
    total.value = res.total || 0
  }
  catch (e) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载 URL 列表失败')
    pageRows.value = []
    total.value = 0
  }
  finally {
    loading.pages = false
  }
}

async function loadHourly() {
  loading.hourly = true
  try {
    const res = await useAdminFetch('/api/admin/traffic/hourly', {
      query: buildQuery(),
    })
    hourlyRows.value = res.data || []
  }
  catch (e) {
    ElMessage.error(e?.data?.statusMessage || e?.message || '加载小时汇总失败')
    hourlyRows.value = []
  }
  finally {
    loading.hourly = false
  }
}

async function loadAll() {
  await Promise.all([loadOverview(), loadPages(), loadHourly()])
}

function onSearch() {
  page.value = 1
  loadAll()
}

function onReset() {
  filters.range = 'today'
  filters.channel = ''
  filters.device = ''
  page.value = 1
  loadAll()
}

function onPageChange(nextPage) {
  page.value = nextPage
  loadPages()
}

function onSizeChange(nextSize) {
  pageSize.value = nextSize
  page.value = 1
  loadPages()
}

onMounted(loadAll)
</script>

<template>
  <div class="traffic-page">
    <div class="traffic-head">
      <div>
        <h2 class="traffic-title">
          流量分析
        </h2>
        <p class="traffic-subtitle">
          基于 traffic_logs 的后台聚合看板，渠道优先取 utm_source，缺失时回退 ref 和 URL 参数归因；小时统计按 UTC+8 展示。
        </p>
      </div>
    </div>

    <el-card shadow="never" class="traffic-filter-card">
      <el-form :inline="true" @submit.prevent="onSearch">
        <el-form-item label="时间范围">
          <el-select v-model="filters.range" style="width: 160px">
            <el-option
              v-for="opt in rangeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="渠道">
          <el-select v-model="filters.channel" clearable placeholder="所有渠道" style="width: 180px">
            <el-option label="所有渠道" value="" />
            <el-option
              v-for="opt in channelOptions"
              :key="opt"
              :label="opt"
              :value="opt"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="设备">
          <el-select v-model="filters.device" style="width: 160px">
            <el-option
              v-for="opt in deviceOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="onSearch">
            查询
          </el-button>
          <el-button @click="onReset">
            重置
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="traffic-stats" v-loading="loading.overview">
      <el-card v-for="card in statCards" :key="card.label" shadow="hover" class="traffic-stat-card">
        <div class="traffic-stat-label">
          {{ card.label }}
        </div>
        <div class="traffic-stat-value">
          {{ card.value }}
        </div>
      </el-card>
    </div>

    <el-card shadow="never" class="traffic-realtime-card" v-loading="loading.overview">
      <div class="traffic-realtime-inner">
        <div class="traffic-realtime-main">
          <div class="traffic-realtime-label">
            实时访客（过去 5 分钟）
          </div>
          <div class="traffic-realtime-value">
            {{ realtime.activeVisitors }}
          </div>
        </div>
        <el-button type="primary" plain :icon="RefreshRight" @click="loadAll">
          刷新
        </el-button>
      </div>
    </el-card>

    <el-alert
      v-if="!hasTrafficData && !loading.overview && !loading.pages && !loading.hourly"
      type="info"
      :closable="false"
      class="traffic-empty-tip"
      title="当前库里还没有 traffic_logs 数据，页面结构已可用，接入日志后会自动出数。"
    />

    <el-card shadow="never" class="traffic-table-card">
      <template #header>
        <div class="traffic-tab-header">
          <div class="traffic-tab-title">
            <el-icon><DataAnalysis /></el-icon>
            <span>流量明细</span>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="按 URL 展示列表" name="pages">
          <el-table v-loading="loading.pages" :data="pageRows" border stripe>
            <el-table-column prop="url" label="URL" min-width="280" show-overflow-tooltip />
            <el-table-column prop="name" label="Name" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">
                {{ row.name || '—' }}
              </template>
            </el-table-column>
            <el-table-column prop="uv" label="访客(UV)" width="110" />
            <el-table-column prop="pv" label="浏览量(PV)" width="110" />
            <el-table-column prop="pvPerUv" label="PV/UV" width="100">
              <template #default="{ row }">
                {{ formatDecimal(row.pvPerUv) }}
              </template>
            </el-table-column>
            <el-table-column prop="avgPageStay" label="停留时长(S)" width="120">
              <template #default="{ row }">
                {{ formatDecimal(row.avgPageStay) }}
              </template>
            </el-table-column>
            <el-table-column prop="conversions" label="转化次数" width="110" />
            <el-table-column prop="conversionRate" label="转化率" width="110">
              <template #default="{ row }">
                {{ formatPercent(row.conversionRate) }}
              </template>
            </el-table-column>
          </el-table>

          <div class="traffic-pagination">
            <el-pagination
              background
              layout="total, sizes, prev, pager, next"
              :current-page="page"
              :page-size="pageSize"
              :page-sizes="[20, 50, 100]"
              :total="total"
              @current-change="onPageChange"
              @size-change="onSizeChange"
            />
          </div>
        </el-tab-pane>

        <el-tab-pane label="每小时汇总列表" name="hourly">
          <el-table v-loading="loading.hourly" :data="hourlyRows" border stripe>
            <el-table-column prop="hourLabel" label="小时" min-width="160" />
            <el-table-column prop="uv" label="访客(UV)" width="110" />
            <el-table-column prop="pv" label="浏览量(PV)" width="110" />
            <el-table-column prop="pvPerUv" label="PV/UV" width="100">
              <template #default="{ row }">
                {{ formatDecimal(row.pvPerUv) }}
              </template>
            </el-table-column>
            <el-table-column prop="avgPageStay" label="停留时长(S)" width="120">
              <template #default="{ row }">
                {{ formatDecimal(row.avgPageStay) }}
              </template>
            </el-table-column>
            <el-table-column prop="conversions" label="转化次数" width="110" />
            <el-table-column prop="conversionRate" label="转化率" width="110">
              <template #default="{ row }">
                {{ formatPercent(row.conversionRate) }}
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<style scoped>
.traffic-page {
  min-width: 0;
}

.traffic-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.traffic-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #111827;
}

.traffic-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #6b7280;
}

.traffic-filter-card,
.traffic-realtime-card,
.traffic-table-card,
.traffic-empty-tip {
  margin-bottom: 16px;
}

.traffic-stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
}

.traffic-stat-card :deep(.el-card__body) {
  padding: 18px 16px;
}

.traffic-stat-label {
  font-size: 13px;
  color: #6b7280;
}

.traffic-stat-value {
  margin-top: 10px;
  font-size: 28px;
  line-height: 1;
  font-weight: 700;
  color: #111827;
}

.traffic-realtime-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.traffic-realtime-label {
  font-size: 14px;
  color: #6b7280;
}

.traffic-realtime-value {
  margin-top: 6px;
  font-size: 32px;
  font-weight: 700;
  color: #111827;
}

.traffic-tab-header,
.traffic-tab-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.traffic-pagination {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 1400px) {
  .traffic-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 900px) {
  .traffic-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .traffic-stats {
    grid-template-columns: 1fr;
  }

  .traffic-realtime-inner {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
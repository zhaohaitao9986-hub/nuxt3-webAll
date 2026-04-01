<template>
    <div>
        <TestHeader />
        88888
        <div @click="setInofo">按钮</div>
    </div>
</template>
<script setup lang="ts">
import TestHeader from '../components/TestHeader.vue';
import { getUserInfo, settUserInfo } from '../api/api'
const { data } = await getUserInfo()
console.log(data.value, 'data.value========>')
const setInofo = async () => {
    const  data  = await settUserInfo()
    console.log(data,'setData===============>')
}
</script>

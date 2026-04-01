<template>
    <div>
        test111
        <div class="flex w-[100px] h-[100px] bg:#000 ">
            22222
        </div>
        <div>
            <AppHeader/>
        </div>
        <div>66666</div>
        <component :is="activeView" v-if="activeView" />
    </div>
</template>
<script setup>
import { defineAsyncComponent, shallowRef, watchEffect, ref } from 'vue';
const activeView = defineAsyncComponent(() => import('~/themes/de.test.com/view/home.vue'))
</script>
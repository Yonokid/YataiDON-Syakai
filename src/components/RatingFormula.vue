<template>
  <details class="group text-sm">
    <summary class="muted inline-flex cursor-pointer list-none items-center gap-1 select-none hover:text-neutral-900 dark:hover:text-neutral-100">
      <span class="transition-transform group-open:rotate-90">›</span>
      {{ $t('rating.summary') }}
    </summary>
    <div class="card mt-2 flex max-w-xl flex-col gap-2 text-sm">
      <p class="font-mono text-xs">{{ $t('rating.formulaPlayer') }}</p>
      <p class="font-mono text-xs">{{ $t('rating.formulaSong') }}</p>
      <ul class="muted flex list-disc flex-col gap-1 pl-5">
        <li>{{ $t('rating.constant') }}</li>
        <li>{{ $t('rating.factor') }}</li>
        <li>{{ $t('rating.crown') }}</li>
        <li>{{ $t('rating.scope') }}</li>
      </ul>
    </div>
  </details>
</template>

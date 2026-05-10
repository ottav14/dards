<script lang="ts">
    export let callback: (val: string) => void;
</script>

<div>
    <button
        on:click={() => callback('official_lobbies')}
    >
        Official Lobbies
    </button>
</div>

<style>
    div {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
    }

    button {
        padding: 2rem;
        font-size: 16pt;
    }
</style>

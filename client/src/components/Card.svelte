<script lang="ts">
    export let type: string = 'AD';
    export let playable: boolean = false;
    export let onClick: () => void = () => {};
    export let overlap: number = 0;
    export let selected = false;

</script>

<button
    on:click={onClick}
    class={playable ? 'playable' : 'not-playable'}
    style={`margin: ${-overlap}rem`}
>
    {#if type !== ''}
        <img 
            src={`${type}.svg`} 
            alt={type}
        class={`
            ${playable ? 'playable' : 'not-playable'}
            ${selected ? 'selected' : 'not-selected'}
        `}
        />
    {:else}
        <div></div>
    {/if}
</button>

<style>
    button {
        background: transparent;
        border: none;
        transition: transform 0.2s ease;
    }

    img, div {
        width: 4.5rem;
        height: 7rem;
        background: white;
        transform: translateY(0);
        transition: transform 0.2s ease;
    }

    .playable:hover :not(.selected), .selected {
        transform: translateY(-0.5rem);
    }
</style>

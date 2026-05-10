<script lang="ts">

    export let uuid: string;
    export let ws: WebSocket;
    export let playerName: string;

    let open = false;
    const cardValues = [ 'A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K' ];

    const ask = (val: string) => {
        open = false;
        ws.send(JSON.stringify({
            type: 'go_fish_ask',
            val: val,
            askName: playerName,
            uuid: uuid
        }));
    }
</script>

<div class="askButtonContainer">
    <button 
         class="askButton"
         on:click={() => {
             open = !open;
         }}
     >
        Ask
    </button>
    {#if open}
        <div class="menu">
            {#each cardValues as val}
                <button
                    class="cardButton"
                    on:click={() => ask(val)}
                >
                    {val}
                </button>
            {/each}
        </div>
    {/if}
</div>

<style>
    .askButtonContainer {
        position: relative;
    }

    .menu {
        display: flex;
        flex-direction: column;
        width: 5rem;
        position: absolute;
        top: 0;
        left: 100%;
        background: #e9e9e9;
        z-index: 1;
    }
</style>

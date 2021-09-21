import json
import requests
import argparse
import numpy as np
import pandas as pd
from bloxplorer import bitcoin_explorer
import networkx as nx
import matplotlib.pyplot as plt
from retrying import retry
# from networkx.drawing.nx_agraph import graphviz_layout, to_agraph

import pdb

"""
TODO:
 - add in retry logic if api call fails 
 - add in error handling
 - figure out better way to display graph (all inputs one side, all outputs other side)
"""



SATOSHI_VAL = 0.00000001

parser = argparse.ArgumentParser(description='traverse txs')
parser.add_argument('--address', metavar='address', type=str, required=True,
                    help='address to retrieve txs and graph')
parser.add_argument('--max_depth', metavar='max_depth', type=int, required=True,
                    help='number of levels to explore in either direction')


@retry
def get_all_txs(address):
    """
    gets all txs from bitcoin explorer,
    can only retrieve 25 at a time so we 
    check to see if last recieved tx is earliest
    """
    response = bitcoin_explorer.addr.get_confirmed_tx_history(address)
    df = pd.json_normalize(response.data, max_level=1)
    if len(df.index) == 25: #25 is the max num of txs returned from this endpoint, look for more
        new_txid = True
        while new_txid:
            # get last recieved tx
            last_txid = df.txid.to_list()[-1]
            temp_response = bitcoin_explorer.addr.get_confirmed_tx_history(
                address, 
                last_seen_txid=last_txid
            )
            df = df.append(pd.json_normalize(temp_response.data, max_level=1))
            new_txid = last_txid == df.txid.to_list()[-1]
    # fix index for neatness
    df.reset_index(drop=True, inplace=True)
    return df


@retry
def get_inputs(df, src_addr):
    """
    check if a tx is an incoming tx,
    if it is retrieve from addr, txid,
    and value
    TODO: 
        - work on this data format since we change it later
        - eventually use rpc calls with running full node to not rely on 
          external calls to api
    """
    recieving = []
    for tx in df.txid.to_list():
        raw_tx = requests.get(f"https://blockchain.info/rawtx/{tx}").json()
        input_addrs = []
        for tx_input in raw_tx['inputs']:
            # print(f"input address for {tx} {tx_input['prev_out']['addr']}")
            input_addrs.append(tx_input['prev_out']['addr'])
        for output in raw_tx['out']:
            # print(output['value'], output['addr'])
            if output['addr'] == src_addr:
                recieving.append({
                    'txid': tx,
                    'from': input_addrs,
                    'to': output['addr'],
                    'value': output['value'] * SATOSHI_VAL
                })
    return recieving


@retry
def get_outputs(df, src_addr):
    """
    check if a tx is an outgoing tx,
    if it is retrieve to addr, txid,
    and value
    TODO: 
        - work on this data format since we change it later
        - eventually use rpc calls with running full node to not rely on 
          external calls to api
        - see if better way to get value sent since change addrs can come into play
    """
    outgoing = []
    for tx in df.txid.to_list():
        raw_tx = requests.get(f"https://blockchain.info/rawtx/{tx}").json()
        output_addrs = []
        for output in raw_tx['out']:
            # print(output['value'], output['addr'])
            output_addrs.append(output['addr'])
        for tx_input in raw_tx['inputs']:
            # print(f"input address for {tx} {tx_input['prev_out']['addr']}")
            if tx_input['prev_out']['addr'] == src_addr:
                outgoing.append({
                    'txid': tx,
                    'from': src_addr,
                    'to': output_addrs,
                    'value': tx_input['prev_out']['value'] * SATOSHI_VAL 
                    # value in prev_out is just inputs, can be inaccurate 
                    # not actual amount spent,
                    #  will need to get from outputs
                })
    return outgoing


def graph_inputs(graph, tx_data, to_addr):
    """
    graphs inputs
    TODO:
        - once incoming tx_data has changed format work on groupby logic
    """
    df_in = pd.DataFrame(tx_data)
    res = df_in.groupby(df_in['from'].map(tuple))['value'].sum().reset_index()
    res['from'] = res['from'].map(list)
    tx_data = res.to_dict(orient='records')
    input_addrs = []
    for tx in tx_data:
        for from_addr in tx['from']:
            graph.add_edges_from([(from_addr, to_addr)])



def graph_outputs(graph, tx_data, from_addr):
    """
    graphs outputs
    TODO:
        - once incoming tx_data has changed format work on groupby logic
    """
    df_out = pd.DataFrame(tx_data)
    res = df_out.groupby(df_out['to'].map(tuple))['value'].sum().reset_index()
    res['to'] = res['to'].map(list)
    tx_data = res.to_dict(orient='records')
    for tx in tx_data:
        for to_addr in tx['to']:
            graph.add_edges_from([(from_addr, to_addr)])



def explore(nodes, depth, go_up):
    """
    explores inputs and outputs
    params:
     - nodes: nodes to start exploring
     - depth: number of levels to explore
     - go_up: True: looks at predecessors | False: looks at successors
    """
    if depth >= 1:
        for i in range(depth):
            x_addrs = []
            for node in nodes:
                if '[' not in node: #bad check for if its single element, eventually handle multi addr inputs
                    x_addrs.append(node)
                    all_txs = get_all_txs(node)
                    txs_in = get_inputs(all_txs, node)
                    txs_out = get_outputs(all_txs, node)
                    graph_inputs(G, txs_in, node)
                    graph_outputs(G, txs_out, node)
            x_nodes = []
            for addr in x_addrs:
                y_nodes = G.predecessors(addr) if go_up else G.successors(addr)
                for y_node in y_nodes:
                    x_nodes.append(y_node)
            nodes = x_nodes



if __name__ == "__main__":
    args = parser.parse_args()
    addr = args.address
    max_depth = args.max_depth

    G = nx.DiGraph()
    G.add_node(addr)

    # get all txs then get data for in / out txs
    all_txs = get_all_txs(addr)
    txs_in = get_inputs(all_txs, addr)
    txs_out = get_outputs(all_txs, addr)

    # pdb.set_trace()
    # create graph
    graph_inputs(G, txs_in, addr)
    graph_outputs(G, txs_out, addr)


    preds = G.predecessors(addr)
    # pdb.set_trace()
    explore(preds, max_depth, True)
    # pdb.set_trace()

    succs = G.successors(addr)
    # pdb.set_trace()
    explore(succs, max_depth, False)
    # pdb.set_trace()


    # get labels to show up
    # labels = {}
    # for u,v,data in G.edges(data=True):
    #     labels[(u,v)] = data['weight']

    pos = nx.spring_layout(G, k=0.3*1/np.sqrt(len(G.nodes())), iterations=20)
    
    # pos = nx.circular_layout(G)
    plt.figure(3, figsize=(50, 50))
    # nx.draw_circular(G, with_labels=True)
    nx.draw(G, with_labels=True)
    # nx.draw_networkx_edge_labels(G, pos, edge_labels=labels)
    # l,r = plt.xlim()
    # plt.xlim(l-2,r+2)
    plt.savefig('fooo2.png')
    # plt.clf()


    # A = to_agraph(G)
    # A.layout('dot')
    # A.draw('abcd.png')

    # A = to_agraph(G)        # convert to a graphviz graph
    # A.layout(prog='dot')            # neato layout
    #A.draw('test3.pdf')

    # A.draw('test3.png',args='-Gnodesep=0.01 -Gfont_size=1', prog='dot' )  
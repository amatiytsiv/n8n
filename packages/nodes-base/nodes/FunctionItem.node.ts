import { IExecuteSingleFunctions } from 'n8n-core';
import {
	IBinaryKeyData,
	IDataObject,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

const { NodeVM } = require('vm2');

export class FunctionItem implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Function Item',
		name: 'functionItem',
		icon: 'fa:code',
		group: ['transform'],
		version: 1,
		description: 'Run custom function code which gets executed once per item.',
		defaults: {
			name: 'FunctionItem',
			color: '#ddbb33',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			{
				displayName: 'Function',
				name: 'functionCode',
				typeOptions: {
					alwaysOpenEditWindow: true,
					editor: 'code',
					rows: 10,
				},
				type: 'string',
				default: 'item.myVariable = 1;\nreturn item;',
				description: 'The JavaScript code to execute for each item.',
				noDataExpression: true,
			},
		],
	};

	async executeSingle(this: IExecuteSingleFunctions): Promise<INodeExecutionData> {
		let item = this.getInputData();

		// Copy the items as they may get changed in the functions
		item = JSON.parse(JSON.stringify(item));

		// Define the global objects for the custom function
		const sandbox = {
			getBinaryData: (): IBinaryKeyData | undefined => {
				return item.binary;
			},
			getNodeParameter: this.getNodeParameter,
			getWorkflowStaticData: this.getWorkflowStaticData,
			helpers: this.helpers,
			item: item.json,
			setBinaryData: (data: IBinaryKeyData) => {
				item.binary = data;
			},
		};

		// Make it possible to access data via $node, $parameter, ...
		const dataProxy = this.getWorkflowDataProxy();
		Object.assign(sandbox, dataProxy);

		const options = {
			console: 'inherit',
			sandbox,
			require: {
				external: false,
				builtin: [] as string[],
				root: './',
			}
		};

		if (process.env.NODE_FUNCTION_ALLOW_BUILTIN) {
			options.require.builtin = process.env.NODE_FUNCTION_ALLOW_BUILTIN.split(',');
		}

		const vm = new NodeVM(options);

		// Get the code to execute
		const functionCode = this.getNodeParameter('functionCode') as string;


		let jsonData: IDataObject;
		try {
			// Execute the function code
			jsonData = await vm.run(`module.exports = async function() {${functionCode}}()`);
		} catch (e) {
			return Promise.reject(e);
		}

		return {
			json: jsonData
		};
	}
}

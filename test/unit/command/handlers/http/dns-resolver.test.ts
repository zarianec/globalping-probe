import {expect} from 'chai';
import * as td from 'testdouble';
import {callbackify} from '../../../../../src/lib/util.js';
import {type ResolverType, type ResolverOptionsType, type Options, type ErrnoException, type IpFamily} from '../../../../../src/command/handlers/http/dns-resolver.js';

export const buildResolver = (ipList: string[]): ResolverType => async (_hostname: string, _options: ResolverOptionsType): Promise<string[]> => ipList;

class NativeResolverMock {
	public resolve4: ResolverType;

	constructor() {
		this.resolve4 = buildResolver(['1.1.1.1']);
	}
}

describe('http helper', () => {
	let dnsLookup: (resolverAddr: string | undefined, resolverFn?: ResolverType) => (hostname: string, options: Options) => Promise<Error | ErrnoException | [string, number]>;

	before(async () => {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		await td.replaceEsm('node:dns', null, {promises: {Resolver: NativeResolverMock}});
		({dnsLookup} = await import('../../../../../src/command/handlers/http/dns-resolver.js'));
	});

	after(() => {
		td.reset();
	});

	describe('dns', () => {
		it('should return an error (private ip)', async () => {
			const data = {
				ipList: ['192.168.0.1'],
				hostname: 'abc.com',
				options: {
					family: 4 as IpFamily,
				},
			};

			const resolver = buildResolver(data.ipList);
			const lookup = dnsLookup(undefined, resolver);

			let response: unknown;

			try {
				response = await lookup(
					data.hostname,
					data.options,
				) as [string, number];
			} catch (error: unknown) {
				response = error;
			}

			expect(response).to.be.instanceof(Error);
		});

		it('should filter out private ip, return public ip', async () => {
			const data = {
				ipList: ['192.168.0.1', '1.1.1.1'],
				hostname: 'abc.com',
				options: {
					family: 4 as IpFamily,
				},
			};

			const resolver = buildResolver(data.ipList);
			const lookup = dnsLookup(undefined, resolver);

			const response = await lookup(
				data.hostname,
				data.options,
			) as [string, number];

			expect(response).to.deep.equal(['1.1.1.1', 4]);
		});

		it('should pass - callbackify', done => {
			const data = {
				ipList: ['192.168.0.1', '1.1.1.1'],
				hostname: 'abc.com',
				options: {
					family: 4 as IpFamily,
				},
			};

			const resolver = buildResolver(data.ipList);
			const lookup = callbackify(dnsLookup(undefined, resolver), true);

			lookup(
				data.hostname,
				data.options,
				(_error: undefined, result: string, family: number) => {
					expect(result).to.deep.equal('1.1.1.1');
					expect(family).to.equal(4);
					done();
				},
			);
		});

		it('should use native resolver if not provided', async () => {
			const data = {
				hostname: 'abc.com',
				options: {
					family: 4 as IpFamily,
				},
			};

			const lookup = dnsLookup(undefined);

			const response = await lookup(
				data.hostname,
				data.options,
			) as [string, number];

			expect(response).to.deep.equal(['1.1.1.1', 4]);
		});
	});
});

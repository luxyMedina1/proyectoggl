"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { IoChevronDownOutline } from 'react-icons/io5';
import { COUNTRY_CODES, CountryCode, isoToFlagEmoji } from '../../data/countryCodes';

interface Props {
    value: CountryCode;
    onChange: (c: CountryCode) => void;
}

export const CountryCodeSelect = ({ value, onChange }: Props) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 0);
        }
    }, [open]);

    const normalize = (s: string) =>
        s
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]/gi, '')
            .toLowerCase();

    const filtered = useMemo(() => {
        const q = normalize(query.trim());
        if (!q) return COUNTRY_CODES;
        return COUNTRY_CODES.filter(
            (c) =>
                normalize(c.name).includes(q) ||
                c.dialCode.includes(q) ||
                c.iso2.toLowerCase().includes(q),
        );
    }, [query]);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full h-[42px] flex items-center justify-between gap-x-2 border border-gray-300 rounded-lg px-3 bg-white focus:outline-none focus:ring-1 focus:ring-accentBase"
            >
                <span className="flex items-center gap-x-2">
                    <span className="text-xl leading-none">{isoToFlagEmoji(value.iso2)}</span>
                    <span className="text-gray-700 text-sm">+{value.dialCode}</span>
                </span>
                <IoChevronDownOutline className="text-gray-400" />
            </button>
            {open && (
                <div className="absolute z-20 mt-1 w-72 max-w-[90vw] bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-100">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar país o código"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-accentBase"
                        />
                    </div>
                    <ul className="overflow-y-auto flex-1">
                        {filtered.map((c) => (
                            <li key={`${c.iso2}-${c.dialCode}`}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        onChange(c);
                                        setOpen(false);
                                        setQuery('');
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center gap-x-2 text-sm"
                                >
                                    <span className="text-lg leading-none">{isoToFlagEmoji(c.iso2)}</span>
                                    <span className="flex-1 truncate">{c.name}</span>
                                    <span className="text-gray-500">+{c.dialCode}</span>
                                </button>
                            </li>
                        ))}
                        {filtered.length === 0 && (
                            <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

window.SIKH_GURUS_DATASET = {
  "schema_version": "1.0",
  "meta": {
    "title": "Sikh Gurus family tree (close relations)",
    "notes": [
      "Dates are stored as ISO-8601 strings when day-level is known.",
      "If a date is disputed or multiple milestones exist (selection vs formal gurgaddi), use date_variants.",
      "Relationship links reference person IDs in people[].",
      "Optional fields may appear, e.g. events.birth.place."
    ],
    "sources": [
      "https://en.wikipedia.org/wiki/Guru_Nanak",
      "https://en.wikipedia.org/wiki/Guru_Angad",
      "https://en.wikipedia.org/wiki/Guru_Amar_Das",
      "https://en.wikipedia.org/wiki/Guru_Ram_Das",
      "https://en.wikipedia.org/wiki/Guru_Arjan",
      "https://en.wikipedia.org/wiki/Guru_Hargobind",
      "https://en.wikipedia.org/wiki/Guru_Har_Rai",
      "https://en.wikipedia.org/wiki/Guru_Har_Krishan",
      "https://en.wikipedia.org/wiki/Guru_Tegh_Bahadur",
      "https://en.wikipedia.org/wiki/Guru_Gobind_Singh"
    ]
  },
  "people": [
    {
      "id": "guru_nanak",
      "name": "Sri Guru Nanak Dev Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1469-10-29",
          "label": "Prakash",
          "place": "Rai Bhoi Ki Talwandi (present-day Nankana Sahib, Punjab, Pakistan)"
        },
        "gurgaddi": {
          "date": "1469-10-29",
          "date_variants": [
            {
              "date": "1507-08-20",
              "note": "Kept as variant from prior source; not present in provided date table."
            },
            {
              "date": "1500",
              "precision": "year",
              "note": "Some summaries list c.1500 start; kept as variant."
            }
          ]
        },
        "death": {
          "date": "1539-09-17",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "mehta_kalu",
        "mother": "mata_tripta",
        "spouses": [
          "mata_sulakhani"
        ],
        "siblings": [
          "bebe_nanaki"
        ],
        "children": [
          "sri_chand",
          "lakhmi_das"
        ]
      },
      "succession": {
        "predecessor": null,
        "successor": "guru_angad"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Nanak"
      ]
    },
    {
      "id": "guru_angad",
      "name": "Sri Guru Angad Dev Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1504-04-25",
          "label": "Prakash",
          "place": "Matte-di-Sarai (Sarainaga), Sri Muktsar Sahib district, Punjab, India"
        },
        "gurgaddi": {
          "date": "1539-09-13",
          "date_variants": [
            {
              "date": "1539-06-14",
              "note": "Selection/nomination date appears separately from formal installation."
            }
          ]
        },
        "death": {
          "date": "1552-04-08",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "baba_pheru_mal",
        "mother": "mata_ramo",
        "spouses": [
          "mata_khivi"
        ],
        "siblings": [],
        "children": [
          "dasu",
          "datu",
          "bibi_amro",
          "bibi_anokhi"
        ]
      },
      "succession": {
        "predecessor": "guru_nanak",
        "successor": "guru_amar_das"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Angad"
      ]
    },
    {
      "id": "guru_amar_das",
      "name": "Sri Guru Amardas Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1479-05-14",
          "label": "Prakash",
          "place": "Basarke, Amritsar district, Punjab, India",
          "date_variants": [
            {
              "date": "1479",
              "precision": "year",
              "note": "Some sources dispute year; keep as variant container."
            }
          ]
        },
        "gurgaddi": {
          "date": "1552-04-05",
          "date_variants": [
            {
              "date": "1552-03-29",
              "note": "Alternate date cited in some summaries."
            }
          ]
        },
        "death": {
          "date": "1574-09-11",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "tej_bhan",
        "mother": "mata_lachmi_devi",
        "spouses": [
          "mansa_devi"
        ],
        "siblings": [],
        "children": [
          "mohan",
          "mohri",
          "bibi_bhani",
          "dani"
        ]
      },
      "succession": {
        "predecessor": "guru_angad",
        "successor": "guru_ram_das"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Amar_Das"
      ]
    },
    {
      "id": "guru_ram_das",
      "name": "Sri Guru Ramdas Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1534-10-04",
          "label": "Prakash",
          "place": "Chuna Mandi, Lahore, Punjab, Pakistan"
        },
        "gurgaddi": {
          "date": "1574-09-09",
          "date_variants": [
            {
              "date": "1574-09-01",
              "note": "Some summaries list start date as 1 Sep 1574."
            }
          ]
        },
        "death": {
          "date": "1581-09-11",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "hari_das",
        "mother": "mata_daya_devi",
        "spouses": [
          "bibi_bhani"
        ],
        "siblings": [],
        "children": [
          "prithi_chand",
          "mahadev",
          "guru_arjan"
        ]
      },
      "succession": {
        "predecessor": "guru_amar_das",
        "successor": "guru_arjan"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Ram_Das"
      ]
    },
    {
      "id": "guru_arjan",
      "name": "Sri Guru Arjan Dev Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1563-04-25",
          "label": "Prakash",
          "place": "Goindval (Goindwal Sahib), Tarn Taran district, Punjab, India"
        },
        "gurgaddi": {
          "date": "1581-09-10"
        },
        "death": {
          "date": "1606-06-09",
          "label": "Shaheedi / Joti Jot"
        }
      },
      "family": {
        "father": "guru_ram_das",
        "mother": "bibi_bhani",
        "spouses": [
          "mata_ganga"
        ],
        "siblings": [
          "prithi_chand",
          "mahadev"
        ],
        "children": [
          "guru_hargobind"
        ]
      },
      "succession": {
        "predecessor": "guru_ram_das",
        "successor": "guru_hargobind"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Arjan"
      ]
    },
    {
      "id": "guru_hargobind",
      "name": "Sri Guru Hargobind Sahib Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1595-06-22",
          "label": "Prakash",
          "place": "Guru Ki Wadali, near Amritsar, Punjab, India",
          "date_variants": [
            {
              "date": "1590",
              "precision": "year",
              "note": "Alternate birth year appears in some sources."
            }
          ]
        },
        "gurgaddi": {
          "date": "1606-05-29",
          "date_variants": [
            {
              "date": "1606-05-25",
              "note": "Some timelines use 25 May 1606 as start of office."
            }
          ]
        },
        "death": {
          "date": "1644-03-13",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "guru_arjan",
        "mother": "mata_ganga",
        "spouses": [
          "mata_damodari",
          "mata_nanaki_hargobind",
          "mata_marvahi",
          "mata_kaulan"
        ],
        "siblings": [],
        "children": [
          "baba_gurditta",
          "suraj_mal",
          "ani_rai",
          "atal_rai",
          "guru_tegh_bahadur",
          "bibi_viro"
        ]
      },
      "succession": {
        "predecessor": "guru_arjan",
        "successor": "guru_har_rai"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Hargobind"
      ]
    },
    {
      "id": "guru_har_rai",
      "name": "Sri Guru Harrai Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1630-01-26",
          "label": "Prakash",
          "place": "Kiratpur Sahib, Rupnagar (Ropar), Punjab, India"
        },
        "gurgaddi": {
          "date": "1644-03-06"
        },
        "death": {
          "date": "1661-10-16",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "baba_gurditta",
        "mother": "mata_nihal_kaur",
        "spouses": [
          "mata_krishen_devi"
        ],
        "siblings": [
          "dhir_mal"
        ],
        "children": [
          "ram_rai",
          "rup_kaur",
          "guru_har_krishan"
        ]
      },
      "succession": {
        "predecessor": "guru_hargobind",
        "successor": "guru_har_krishan"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Har_Rai"
      ]
    },
    {
      "id": "guru_har_krishan",
      "name": "Sri Guru Harkrishan Sahib Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1656-07-16",
          "label": "Prakash",
          "place": "Kiratpur Sahib, Rupnagar (Ropar), Punjab, India",
          "date_variants": [
            {
              "date": "1652-07-20",
              "note": "Conflicting date appears in some text summaries; keep as variant."
            }
          ]
        },
        "gurgaddi": {
          "date": "1661-10-16"
        },
        "death": {
          "date": "1664-04-09",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "guru_har_rai",
        "mother": "mata_krishen_devi",
        "spouses": [],
        "siblings": [
          "ram_rai",
          "rup_kaur"
        ],
        "children": []
      },
      "succession": {
        "predecessor": "guru_har_rai",
        "successor": "guru_tegh_bahadur"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Har_Krishan"
      ]
    },
    {
      "id": "guru_tegh_bahadur",
      "name": "Sri Guru Teg Bahadar Sahib Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1621-04-11",
          "label": "Prakash",
          "place": "Amritsar, Punjab, India"
        },
        "gurgaddi": {
          "date": "1664-04-09",
          "date_variants": [
            {
              "date": "1664-08",
              "precision": "month",
              "note": "Some accounts state appointment in Aug 1664."
            }
          ]
        },
        "death": {
          "date": "1675-11-21",
          "label": "Shaheedi / Joti Jot"
        }
      },
      "family": {
        "father": "guru_hargobind",
        "mother": "mata_nanaki_hargobind",
        "spouses": [
          "mata_gujri"
        ],
        "siblings": [
          "baba_gurditta",
          "suraj_mal",
          "ani_rai",
          "atal_rai",
          "bibi_viro"
        ],
        "children": [
          "guru_gobind_singh"
        ]
      },
      "succession": {
        "predecessor": "guru_har_krishan",
        "successor": "guru_gobind_singh"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Tegh_Bahadur"
      ]
    },
    {
      "id": "guru_gobind_singh",
      "name": "Sri Guru Gobind Singh Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1667-01-01",
          "label": "Prakash",
          "place": "Patna Sahib (Patna), Bihar, India"
        },
        "gurgaddi": {
          "date": "1675-11-19",
          "date_variants": [
            {
              "date": "1675-11-11",
              "note": "Some timelines count succession immediately after Guru Tegh Bahadur's martyrdom."
            }
          ]
        },
        "death": {
          "date": "1708-10-18",
          "label": "Joti Jot"
        }
      },
      "family": {
        "father": "guru_tegh_bahadur",
        "mother": "mata_gujri",
        "spouses": [
          "mata_jito",
          "mata_sundari",
          "mata_sahib_kaur"
        ],
        "siblings": [],
        "children": [
          "ajit_singh",
          "jujhar_singh",
          "zorawar_singh",
          "fateh_singh"
        ]
      },
      "succession": {
        "predecessor": "guru_tegh_bahadur",
        "successor": "guru_granth_sahib"
      },
      "sources": [
        "https://en.wikipedia.org/wiki/Guru_Gobind_Singh"
      ]
    },
    {
      "id": "guru_granth_sahib",
      "name": "Sri Guru Granth Sahib Ji",
      "type": "guru",
      "events": {
        "birth": {
          "date": "1604-08-26",
          "label": "Parkash / Compilation"
        },
        "gurgaddi": {
          "date": "1708-10-15"
        },
        "death": {
          "date": null,
          "label": null
        }
      },
      "family": {
        "father": null,
        "mother": null,
        "spouses": [],
        "siblings": [],
        "children": []
      },
      "succession": {
        "predecessor": "guru_gobind_singh",
        "successor": null
      },
      "sources": []
    },
    {
      "id": "mehta_kalu",
      "name": "Mehta Kalu Ji",
      "type": "person"
    },
    {
      "id": "mata_tripta",
      "name": "Mata Tripta Ji",
      "type": "person"
    },
    {
      "id": "mata_sulakhani",
      "name": "Mata Sulakhani Ji",
      "type": "person"
    },
    {
      "id": "bebe_nanaki",
      "name": "Bebe Nanaki Ji",
      "type": "person"
    },
    {
      "id": "sri_chand",
      "name": "Sri Chand Ji",
      "type": "person"
    },
    {
      "id": "lakhmi_das",
      "name": "Lakhmi Das Ji",
      "type": "person"
    },
    {
      "id": "baba_pheru_mal",
      "name": "Baba Pheru Mal Ji",
      "type": "person"
    },
    {
      "id": "mata_ramo",
      "name": "Mata Ramo Ji",
      "type": "person",
      "aliases": [
        "Mata Sabhirai Ji"
      ]
    },
    {
      "id": "mata_khivi",
      "name": "Mata Khivi Ji",
      "type": "person"
    },
    {
      "id": "dasu",
      "name": "Dasu Ji",
      "type": "person"
    },
    {
      "id": "datu",
      "name": "Datu Ji",
      "type": "person"
    },
    {
      "id": "bibi_amro",
      "name": "Bibi Amro Ji",
      "type": "person"
    },
    {
      "id": "bibi_anokhi",
      "name": "Bibi Anokhi Ji",
      "type": "person"
    },
    {
      "id": "tej_bhan",
      "name": "Tej Bhan Ji",
      "type": "person"
    },
    {
      "id": "mata_lachmi_devi",
      "name": "Mata Lachmi Devi Ji",
      "type": "person"
    },
    {
      "id": "mansa_devi",
      "name": "Mansa Devi Ji",
      "type": "person"
    },
    {
      "id": "mohan",
      "name": "Mohan Ji",
      "type": "person"
    },
    {
      "id": "mohri",
      "name": "Mohri Ji",
      "type": "person"
    },
    {
      "id": "dani",
      "name": "Dani Ji",
      "type": "person"
    },
    {
      "id": "bibi_bhani",
      "name": "Bibi Bhani Ji",
      "type": "person"
    },
    {
      "id": "hari_das",
      "name": "Hari Das Ji",
      "type": "person"
    },
    {
      "id": "mata_daya_devi",
      "name": "Mata Daya Devi Ji",
      "type": "person",
      "aliases": [
        "Mata Anup Devi Ji"
      ]
    },
    {
      "id": "prithi_chand",
      "name": "Prithi Chand",
      "type": "person"
    },
    {
      "id": "mahadev",
      "name": "Mahadev Ji",
      "type": "person"
    },
    {
      "id": "mata_ganga",
      "name": "Mata Ganga Ji",
      "type": "person"
    },
    {
      "id": "mata_damodari",
      "name": "Mata Damodari Ji",
      "type": "person"
    },
    {
      "id": "mata_nanaki_hargobind",
      "name": "Mata Nanaki Ji",
      "type": "person"
    },
    {
      "id": "mata_marvahi",
      "name": "Mata Marvahi Ji",
      "type": "person"
    },
    {
      "id": "mata_kaulan",
      "name": "Mata Kaulan Ji",
      "type": "person",
      "aliases": [
        "Kaula Ji"
      ]
    },
    {
      "id": "baba_gurditta",
      "name": "Baba Gurditta Ji",
      "type": "person"
    },
    {
      "id": "suraj_mal",
      "name": "Suraj Mal Ji",
      "type": "person"
    },
    {
      "id": "ani_rai",
      "name": "Ani Rai Ji",
      "type": "person"
    },
    {
      "id": "atal_rai",
      "name": "Atal Rai Ji",
      "type": "person"
    },
    {
      "id": "bibi_viro",
      "name": "Bibi Viro Ji",
      "type": "person"
    },
    {
      "id": "mata_nihal_kaur",
      "name": "Mata Nihal Kaur Ji",
      "type": "person",
      "aliases": [
        "Mata Ananti Ji"
      ]
    },
    {
      "id": "mata_krishen_devi",
      "name": "Mata Krishen Devi Ji",
      "type": "person",
      "aliases": [
        "Mata Kishan Kaur Ji",
        "Sulakhni Ji"
      ]
    },
    {
      "id": "dhir_mal",
      "name": "Dhir Mal Ji",
      "type": "person"
    },
    {
      "id": "ram_rai",
      "name": "Ram Rai Ji",
      "type": "person"
    },
    {
      "id": "rup_kaur",
      "name": "Roop Kaur Ji",
      "type": "person"
    },
    {
      "id": "mata_gujri",
      "name": "Mata Gujri Ji",
      "type": "person"
    },
    {
      "id": "mata_jito",
      "name": "Mata Jito Ji",
      "type": "person",
      "aliases": [
        "Mata Ajeet Kaur Ji"
      ]
    },
    {
      "id": "mata_sundari",
      "name": "Mata Sundari Ji",
      "type": "person",
      "aliases": [
        "Mata Sundar Kaur Ji"
      ]
    },
    {
      "id": "mata_sahib_kaur",
      "name": "Mata Sahib Kaur Ji",
      "type": "person",
      "aliases": [
        "Mata Sahib Devan Ji"
      ]
    },
    {
      "id": "ajit_singh",
      "name": "Ajit Singh Ji",
      "type": "person"
    },
    {
      "id": "jujhar_singh",
      "name": "Jujhar Singh Ji",
      "type": "person"
    },
    {
      "id": "zorawar_singh",
      "name": "Zorawar Singh Ji",
      "type": "person"
    },
    {
      "id": "fateh_singh",
      "name": "Fateh Singh Ji",
      "type": "person"
    }
  ]
};